import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TextInput, Image, Pressable, SafeAreaView, ActivityIndicator, Alert, Animated, Dimensions, Modal, FlatList } from 'react-native';
import React, { useState, useRef, useEffect } from 'react';
import { extractMedia } from './lib/parser';

import * as FileSystem from 'expo-file-system';
import type { DownloadProgressData } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Feather } from '@expo/vector-icons';

import { GestureHandlerRootView, PanGestureHandler, PinchGestureHandler, TapGestureHandler, State } from 'react-native-gesture-handler';

import * as Haptics from 'expo-haptics';


type Media = {
  images: string[];
  audios: string[];
  videos: string[];
};

type DownloadTracker = {
  [url: string]: {
    progress: number;
  };
};

const TABS = ['All', 'Image', 'Audio', 'Video'];
const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
const contentWidth = windowWidth * 0.9;

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.aac', '.m4a'];
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.flv'];

const getDirectMediaCategory = (url: string): 'Image' | 'Audio' | 'Video' | null => {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (IMAGE_EXTENSIONS.some(ext => pathname.endsWith(ext))) return 'Image';
    if (AUDIO_EXTENSIONS.some(ext => pathname.endsWith(ext))) return 'Audio';
    if (VIDEO_EXTENSIONS.some(ext => pathname.endsWith(ext))) return 'Video';
  } catch (error) {
    return null;
  }
  return null;
};

const darkenColor = (hex: string, amount: number) => {
  let [r, g, b] = hex.match(/\w\w/g)?.map(x => parseInt(x, 16)) ?? [0, 0, 0];
  r = Math.floor(r * (1 - amount));
  g = Math.floor(g * (1 - amount));
  b = Math.floor(b * (1 - amount));
  return `rgb(${r}, ${g}, ${b})`;
};

const ProgressBar = ({ progress }: { progress: number }) => {
  return (
    <View style={styles.progressBarBackground}>
      <View style={[styles.progressBarForeground, { width: `${progress * 100}%` }]} />
    </View>
  );
};

const MediaItem = ({ url, category, downloadInfo, isDownloading, onDownload, onOpenImage, imageRef, activeImage, tabName, onImageLoad, imageOpenAnim }: any) => {
  const isCurrentlyActive = activeImage === url;

  const thumbnailOpacity = imageOpenAnim.interpolate({
    inputRange: [0, 0.5],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const handleLoad = (event: any) => {
    const { width, height } = event.nativeEvent.source;
    if (onImageLoad) {
      onImageLoad(url, { width, height });
    }
  };

  return (
    <View style={styles.resultItemContainer}>
      <View style={styles.resultItem}>
        {category === 'Image' && (
          <Pressable
            ref={imageRef}
            onPress={() => onOpenImage(url, tabName)}
          >
            {isCurrentlyActive ? (
              <Animated.Image
                source={{ uri: url }}
                style={[
                  styles.thumbnail,
                  { opacity: thumbnailOpacity }
                ]}
                resizeMode="cover"
                onLoad={handleLoad}
              />
            ) : (
              <Image
                source={{ uri: url }}
                style={styles.thumbnail}
                resizeMode="cover"
                onLoad={handleLoad}
              />
            )}
          </Pressable>
        )}
        <Text style={styles.linkText} selectable numberOfLines={2} ellipsizeMode="middle">{url}</Text>
        <Pressable
          style={styles.downloadButton}
          onPress={() => onDownload(url, category)}
          disabled={isDownloading}
          android_ripple={{ color: '#aaa', borderless: true, radius: 24 }}
        >
          {downloadInfo ? (
            <ActivityIndicator color={variables.accent} />
          ) : (
            <Feather name="download-cloud" size={24} color={isDownloading ? 'gray' : variables.accent} />
          )}
        </Pressable>
      </View>
      {downloadInfo && <ProgressBar progress={downloadInfo.progress} />}
    </View>
  );
};


export default function App() {
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [link, setLink] = useState('');
  const [media, setMedia] = useState<Media>({ images: [], audios: [], videos: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const animation = useRef(new Animated.Value(0)).current;

  const [downloads, setDownloads] = useState<DownloadTracker>({});
  const [isDownloading, setIsDownloading] = useState(false);

  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [sourceImageGeometry, setSourceImageGeometry] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [targetImageGeometry, setTargetImageGeometry] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [imageDimensions, setImageDimensions] = useState<{ [url: string]: { width: number, height: number } }>({});
  const imageOpenAnim = useRef(new Animated.Value(0)).current;
  const imageRefs = useRef<{ [key: string]: View | null }>({});

  const [isViewerVisible, setIsViewerVisible] = useState(false);

  const baseScale = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const scale = Animated.multiply(baseScale, pinchScale);
  const lastScale = useRef(1);

  const panX = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const lastPanX = useRef(0);
  const lastPanY = useRef(0);

  useEffect(() => {
    if (activeImage && isViewerVisible) {
      imageOpenAnim.setValue(0);
      Animated.spring(imageOpenAnim, {
        toValue: 1,
        useNativeDriver: false,
        bounciness: 8,
        speed: 8,
      }).start();
    }
  }, [activeImage, isViewerVisible]);

  const onPinchGestureEvent = Animated.event(
    [{ nativeEvent: { scale: pinchScale } }],
    { useNativeDriver: true }
  );

  const onPanGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: panX, translationY: panY } }],
    { useNativeDriver: true }
  );

  const onPinchHandlerStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      lastScale.current = Math.max(1, lastScale.current * event.nativeEvent.scale);
      baseScale.setValue(lastScale.current);
      pinchScale.setValue(1);

      if (lastScale.current === 1) {
        lastPanX.current = 0;
        lastPanY.current = 0;
        panX.setOffset(0);
        panY.setOffset(0);
        Animated.parallel([
          Animated.spring(panX, { toValue: 0, useNativeDriver: true }),
          Animated.spring(panY, { toValue: 0, useNativeDriver: true }),
        ]).start();
      }
    }
  };

  const onPanHandlerStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      if (lastScale.current > 1) {
        lastPanX.current += event.nativeEvent.translationX;
        lastPanY.current += event.nativeEvent.translationY;
        panX.setOffset(lastPanX.current);
        panY.setOffset(lastPanY.current);
        panX.setValue(0);
        panY.setValue(0);
      } else {
        const { translationY } = event.nativeEvent;
        const SWIPE_CLOSE_THRESHOLD = 75;

        if (translationY > SWIPE_CLOSE_THRESHOLD) {
          closeImage();
        } else {
          Animated.parallel([
            Animated.spring(panX, { toValue: 0, useNativeDriver: true }),
            Animated.spring(panY, { toValue: 0, useNativeDriver: true }),
          ]).start();
        }
      }
    }
  };


  const onDoubleTapStateChange = (event: any) => {
    if (event.nativeEvent.state === State.ACTIVE) {
      if (lastScale.current > 1) {
        lastScale.current = 1;
        lastPanX.current = 0;
        lastPanY.current = 0;

        panX.setOffset(0);
        panY.setOffset(0);

        Animated.parallel([
          Animated.spring(baseScale, { toValue: 1, useNativeDriver: true }),
          Animated.spring(panX, { toValue: 0, useNativeDriver: true }),
          Animated.spring(panY, { toValue: 0, useNativeDriver: true }),
        ]).start();
      } else {
        lastScale.current = 2;
        Animated.spring(baseScale, { toValue: 2, useNativeDriver: true }).start();
      }
    }
  };

  const handleImageLoad = (url: string, dims: { width: number, height: number }) => {
    setImageDimensions(prev => ({
      ...prev,
      [url]: dims,
    }));
  };

  const resolveUrl = (baseUrl: string, relativeUrl: string): string => {
    if (!relativeUrl) return '';
    if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) return relativeUrl;
    if (relativeUrl.startsWith('//')) return `https:${relativeUrl}`;
    try {
      return new URL(relativeUrl, baseUrl).href;
    } catch (e) {
      console.error(`Could not resolve URL: ${relativeUrl} with base: ${baseUrl}`);
      return '';
    }
  };

  const handlePluck = async () => {
    if (!link.trim()) {
      Alert.alert('Error', 'Please paste a link first.');
      return;
    }
    setIsLoading(true);
    setDownloads({});
    setImageDimensions({});

    try {
      const directMediaCategory = getDirectMediaCategory(link);
      if (directMediaCategory) {
        const newMediaState: Media = { images: [], audios: [], videos: [] };
        if (directMediaCategory === 'Image') newMediaState.images.push(link);
        if (directMediaCategory === 'Audio') newMediaState.audios.push(link);
        if (directMediaCategory === 'Video') newMediaState.videos.push(link);
        setMedia(newMediaState);
        const tabIndex = TABS.indexOf(directMediaCategory);
        if (tabIndex !== -1) handleTabPress(tabIndex);
      } else {
        setMedia({ images: [], audios: [], videos: [] });
        const response = await fetch(link);
        const html = await response.text();
        const baseUrl = response.url;
        const extracted = extractMedia(html);
        setMedia({
          images: extracted.images.map(url => resolveUrl(baseUrl, url)).filter(Boolean),
          audios: extracted.audios.map(url => resolveUrl(baseUrl, url)).filter(Boolean),
          videos: extracted.videos.map(url => resolveUrl(baseUrl, url)).filter(Boolean),
        });
        handleTabPress(0);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error(error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Failed to pluck', 'Could not fetch or parse the link.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabPress = (index: number) => {
    setActiveTabIndex(index);
    Animated.spring(animation, { toValue: index, useNativeDriver: true, bounciness: 2 }).start();
  };

  const handleDownload = async (url: string, tabName: string) => {
    if (isDownloading) {
      Alert.alert('Please wait', 'Another download is already in progress.');
      return;
    }
    setIsDownloading(true);
    let asset = null;

    try {
      let permissions = await MediaLibrary.getPermissionsAsync();
      if (permissions.status !== 'granted') {
        if (permissions.canAskAgain) {
          const { status } = await MediaLibrary.requestPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission Required', 'Please grant permission to save files to continue.');
            setIsDownloading(false);
            return;
          }
        } else {
          Alert.alert('Permission Required', 'Please go to your device settings to enable media library access for Pluck.');
          setIsDownloading(false);
          return;
        }
      }

      const filename = new URL(url).pathname.split('/').pop() || `pluck-download-${Date.now()}`;
      const fileUri = FileSystem.documentDirectory + filename;

      const progressCallback = (progress: DownloadProgressData) => {
        setDownloads(prev => ({
          ...prev,
          [url]: { progress: progress.totalBytesWritten / progress.totalBytesExpectedToWrite },
        }));
      };

      const downloadResumable = FileSystem.createDownloadResumable(url, fileUri, {}, progressCallback);
      setDownloads(prev => ({ ...prev, [url]: { progress: 0 } }));

      const result = await downloadResumable.downloadAsync();
      if (!result) throw new Error("Download failed, no result object returned.");

      asset = await MediaLibrary.createAssetAsync(result.uri);

      try {
        const albumName = `Pluck/${tabName}`;
        let album = await MediaLibrary.getAlbumAsync(albumName);

        if (album == null) {
          await MediaLibrary.createAlbumAsync(albumName, asset, false);
        } else {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        }
      } catch (albumError) {
        console.warn('Could not organize file into album. The file is saved to your main library.', albumError);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        'Success!',
        `${filename} has been saved to your device's media library.`
      );

    } catch (e) {
      console.error(e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Download Failed', 'A critical error occurred while trying to download the file.');
    } finally {
      setDownloads(prev => {
        const newDownloads = { ...prev };
        delete newDownloads[url];
        return newDownloads;
      });
      setIsDownloading(false);
    }
  };

  const openImage = (url: string, tabName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const sourceRef = imageRefs.current[`${tabName}-${url}`];
    if (!sourceRef) {
      console.warn('Source ref not found for image:', url);
      return;
    }

    const calculateGeometryAndAnimate = (imgWidth: number, imgHeight: number) => {
      const aspectRatio = imgWidth / imgHeight;
      let targetWidth = windowWidth;
      let targetHeight = targetWidth / aspectRatio;

      if (targetHeight > windowHeight) {
        targetHeight = windowHeight;
        targetWidth = targetHeight * aspectRatio;
      }

      const targetX = (windowWidth - targetWidth) / 2;
      const targetY = (windowHeight - targetHeight) / 2;

      setTargetImageGeometry({ x: targetX, y: targetY, width: targetWidth, height: targetHeight });
      setActiveImage(url);
      setIsViewerVisible(true);
    };

    sourceRef.measure((_fx, _fy, width, height, px, py) => {
      if (width === 0 || height === 0) {
        console.warn('Image ref measurement returned zero dimensions for:', url);
        return;
      }
      setSourceImageGeometry({ x: px, y: py, width, height });

      const preloadedDimensions = imageDimensions[url];
      if (preloadedDimensions) {
        calculateGeometryAndAnimate(preloadedDimensions.width, preloadedDimensions.height);
      } else {
        console.warn(`Dimensions for ${url} not pre-loaded. Fetching now...`);
        Image.getSize(url,
          (imgWidth, imgHeight) => {
            handleImageLoad(url, { width: imgWidth, height: imgHeight });
            calculateGeometryAndAnimate(imgWidth, imgHeight);
          },
          (error) => {
            console.error(`Couldn't get image size: ${error.message}`);
            Alert.alert("Error", "Could not load image dimensions for animation.");
            setActiveImage(null);
          }
        );
      }
    });
  };

  const onViewerDismiss = () => {
    setActiveImage(null);
    setSourceImageGeometry({ x: 0, y: 0, width: 0, height: 0 });
  };

  const closeImage = () => {
    panX.flattenOffset();
    panY.flattenOffset();

    Animated.parallel([
      Animated.spring(imageOpenAnim, {
        toValue: 0,
        useNativeDriver: false,
        bounciness: 8,
        speed: 8,
      }),
      Animated.spring(baseScale, {
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.spring(panX, {
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.spring(panY, {
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setIsViewerVisible(false);
        lastScale.current = 1;
        baseScale.setValue(1);
        pinchScale.setValue(1);
        lastPanX.current = 0;
        lastPanY.current = 0;
        panX.setOffset(0);
        panY.setOffset(0);
        panX.setValue(0);
        panY.setValue(0);
      }
    });
  };

  const translateX = animation.interpolate({
    inputRange: TABS.map((_, i) => i),
    outputRange: TABS.map((_, i) => -i * contentWidth),
    extrapolate: 'clamp',
  });

  const renderImageViewer = () => {
    if (!isViewerVisible || !activeImage) return null;

    const animatedBackdropStyle = {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'black',
      opacity: imageOpenAnim.interpolate({ inputRange: [0.5, 1], outputRange: [0, 0.9] }),
    };

    const animatedContainerStyle = {
      position: 'absolute' as const,
      left: imageOpenAnim.interpolate({ inputRange: [0, 1], outputRange: [sourceImageGeometry.x, targetImageGeometry.x] }),
      top: imageOpenAnim.interpolate({ inputRange: [0, 1], outputRange: [sourceImageGeometry.y, targetImageGeometry.y] }),
      width: imageOpenAnim.interpolate({ inputRange: [0, 1], outputRange: [sourceImageGeometry.width, targetImageGeometry.width] }),
      height: imageOpenAnim.interpolate({ inputRange: [0, 1], outputRange: [sourceImageGeometry.height, targetImageGeometry.height] }),
      opacity: imageOpenAnim,
    };

    const imageTransformStyle = {
      flex: 1,
      transform: [{ translateX: panX }, { translateY: panY }, { scale }],
    };

    return (
      <Modal
        visible={isViewerVisible}
        transparent
        hardwareAccelerated
        onRequestClose={closeImage}
        onDismiss={onViewerDismiss}
      >
        <GestureHandlerRootView style={styles.imageViewerContainer}>
          <Animated.View style={animatedBackdropStyle} />
          <Pressable style={StyleSheet.absoluteFill} onPress={closeImage} />
          <Animated.View style={animatedContainerStyle}>
            <PanGestureHandler
              onGestureEvent={onPanGestureEvent}
              onHandlerStateChange={onPanHandlerStateChange}
              minPointers={1}
              maxPointers={1}
            >
              <Animated.View style={styles.imageViewerContainer}>
                <PinchGestureHandler
                  onGestureEvent={onPinchGestureEvent}
                  onHandlerStateChange={onPinchHandlerStateChange}
                >
                  <Animated.View style={styles.imageViewerContainer}>
                    <TapGestureHandler
                      onHandlerStateChange={onDoubleTapStateChange}
                      numberOfTaps={2}
                    >
                      <Animated.Image
                        source={{ uri: activeImage }}
                        style={imageTransformStyle}
                        resizeMode="contain"
                      />
                    </TapGestureHandler>
                  </Animated.View>
                </PinchGestureHandler>
              </Animated.View>
            </PanGestureHandler>
          </Animated.View>
        </GestureHandlerRootView>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Image source={require('./assets/icon.png')} style={{ width: 100, height: 100, borderRadius: 50 }} />
      <Text style={[styles.text, hStyles.h2, { marginBottom: 30 }]}>See it? Pluck it.</Text>
      <View style={styles.inputForm}>
        <TextInput
          style={[styles.input, isInputFocused ? styles.inputFocus : null]}
          placeholder="Paste link..." placeholderTextColor="gray" autoCapitalize="none" autoCorrect={false}
          onFocus={() => setIsInputFocused(true)} onBlur={() => setIsInputFocused(false)}
          onChangeText={setLink} value={link}
          onSubmitEditing={handlePluck}
          returnKeyType="go"
          autoComplete="off"
          keyboardType="url"
        />
        <View style={styles.buttonWrapper}>
          <Pressable
            android_ripple={{ color: '#aaa', borderless: false, radius: 60 }}
            style={styles.pluckButton} onPress={handlePluck} disabled={isLoading}
          >
            {isLoading ? <ActivityIndicator color="white" /> : <Text style={styles.text}>Pluck</Text>}
          </Pressable>
        </View>
      </View>

      <View style={styles.resultContainer}>
        <View style={styles.tabContainer}>
          {TABS.map((tabName, index) => {
            let count = 0;
            if (tabName === 'All') {
              count = media.images.length + media.audios.length + media.videos.length;
            } else {
              const dataMap = { Image: media.images, Audio: media.audios, Video: media.videos };
              count = dataMap[tabName as keyof typeof dataMap]?.length || 0;
            }

            return (
              <Pressable key={tabName} android_ripple={{ color: '#444', borderless: false }}
                onPress={() => handleTabPress(index)}
                style={[styles.tab, activeTabIndex === index && styles.activeTab]}>
                <Text style={[styles.text, { textAlign: 'center' }]}>{`${tabName}\n(${count})`}</Text>
              </Pressable>
            )
          })}
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={variables.accent} style={{ marginTop: 40 }} />
        ) : (
          <Animated.View style={[styles.animatedContent, { transform: [{ translateX }] }]}>
            {TABS.map((tabName) => {
              let dataToRender: string[] = [];
              if (tabName === 'All') {
                dataToRender = [...media.images, ...media.audios, ...media.videos];
              } else {
                const dataMap = { Image: media.images, Audio: media.audios, Video: media.videos };
                dataToRender = dataMap[tabName as keyof typeof dataMap] || [];
              }

              return (
                <FlatList
                  key={tabName}
                  style={{ width: contentWidth }}
                  contentContainerStyle={styles.results}
                  data={dataToRender}
                  renderItem={({ item: url }) => {
                    const category = tabName === 'All' ? getDirectMediaCategory(url) : tabName;
                    if (!category) return null;

                    return (
                      <MediaItem
                        url={url}
                        category={category}
                        tabName={tabName}
                        downloadInfo={downloads[url]}
                        isDownloading={isDownloading}
                        onDownload={handleDownload}
                        onOpenImage={openImage}
                        onImageLoad={handleImageLoad}
                        imageRef={(el: View | null) => { imageRefs.current[`${tabName}-${url}`] = el; }}
                        activeImage={activeImage}
                        imageOpenAnim={imageOpenAnim}
                      />
                    );
                  }}
                  keyExtractor={(url, index) => `${tabName}-${url}-${index}`}
                  ListEmptyComponent={() => {
                    const message = tabName === 'All' ? 'No media found.' : `No ${tabName.toLowerCase()}s found.`;
                    return <Text style={styles.noResultsText}>{message}</Text>;
                  }}
                  initialNumToRender={10}
                  maxToRenderPerBatch={10}
                  windowSize={11}
                />
              );
            })}
          </Animated.View>
        )}
      </View>
      <StatusBar style="auto" />
      {renderImageViewer()}
    </SafeAreaView>
  );
}

const variables = {
  accent: '#6a71f3',
  spacing: 8
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 20
  },
  text: {
    color: 'white'
  },
  inputForm: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '90%',
    justifyContent: 'space-between'
  },
  input: {
    height: 40,
    flex: 1,
    marginRight: variables.spacing,
    borderColor: 'gray',
    borderWidth: 1,
    borderRadius: variables.spacing,
    paddingHorizontal: 10,
    color: 'white'
  },
  inputFocus: {
    borderColor: variables.accent
  },
  buttonWrapper: {
    borderRadius: variables.spacing,
    overflow: 'hidden',
    height: 40
  },
  pluckButton: {
    backgroundColor: variables.accent,
    paddingVertical: variables.spacing,
    paddingHorizontal: variables.spacing * 2,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minWidth: 70
  },
  resultContainer: {
    flex: 1,
    width: '90%',
    backgroundColor: '#121212',
    overflow: 'hidden',
    borderRadius: variables.spacing * 2,
    marginTop: variables.spacing * 3
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1e1e1e',
    elevation: 4,
    zIndex: 1
  },
  tab: {
    paddingVertical: variables.spacing * 1.5,
    paddingHorizontal: variables.spacing,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent'
  },
  activeTab: {
    borderBottomColor: variables.accent
  },
  animatedContent: {
    flex: 1,
    flexDirection: 'row',
    width: contentWidth * TABS.length
  },
  results: {
    padding: variables.spacing
  },
  noResultsText: {
    color: 'gray',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16
  },
  resultItemContainer: {
    backgroundColor: '#282828',
    borderRadius: variables.spacing,
    marginBottom: variables.spacing,
    overflow: 'hidden',
  },
  resultItem: {
    padding: variables.spacing,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  thumbnail: {
    width: 50,
    height: 50,
    borderRadius: variables.spacing / 2,
    marginRight: variables.spacing,
    backgroundColor: '#444'
  },
  linkText: {
    color: '#eee',
    flex: 1,
    marginRight: variables.spacing
  },
  downloadButton: {
    padding: variables.spacing,
    justifyContent: 'center',
    alignItems: 'center'
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: darkenColor(variables.accent, 0.6),
  },
  progressBarForeground: {
    height: '100%',
    backgroundColor: variables.accent,
  },
  imageViewerContainer: {
    flex: 1,
  },
});

const hStyles = StyleSheet.create({
  h1: { fontWeight: 'bold', fontSize: 32, marginTop: 24, marginBottom: 16 },
  h2: { fontWeight: 'bold', fontSize: 24, marginTop: 20, marginBottom: 14 },
  h3: { fontWeight: 'bold', fontSize: 18.72, marginTop: 16, marginBottom: 12 },
  h4: { fontWeight: 'bold', fontSize: 16, marginTop: 14, marginBottom: 10 },
  h5: { fontWeight: 'bold', fontSize: 13.28, marginTop: 12, marginBottom: 8 },
  h6: { fontWeight: 'bold', fontSize: 10.72, marginTop: 10, marginBottom: 6 },
});