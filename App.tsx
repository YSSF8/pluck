import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TextInput, Image, Pressable, ScrollView, SafeAreaView, ActivityIndicator, Alert, Animated, Dimensions } from 'react-native';
import React, { useState, useRef } from 'react';
import { extractMedia } from './lib/parser';

import * as FileSystem from 'expo-file-system';
import type { DownloadProgressData } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Feather } from '@expo/vector-icons';

type Media = {
  images: string[];
  audios: string[];
  videos: string[];
  others: string[];
};

type DownloadTracker = {
  [url: string]: {
    progress: number;
  };
};

const TABS = ['Image', 'Audio', 'Video', 'Other'];
const { width } = Dimensions.get('window');
const contentWidth = width * 0.9;

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


export default function App() {
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [link, setLink] = useState('');
  const [media, setMedia] = useState<Media>({ images: [], audios: [], videos: [], others: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const animation = useRef(new Animated.Value(0)).current;

  const [downloads, setDownloads] = useState<DownloadTracker>({});
  const [isDownloading, setIsDownloading] = useState(false);


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

    try {
      const directMediaCategory = getDirectMediaCategory(link);
      if (directMediaCategory) {
        const newMediaState: Media = { images: [], audios: [], videos: [], others: [] };
        if (directMediaCategory === 'Image') newMediaState.images.push(link);
        if (directMediaCategory === 'Audio') newMediaState.audios.push(link);
        if (directMediaCategory === 'Video') newMediaState.videos.push(link);
        setMedia(newMediaState);
        const tabIndex = TABS.indexOf(directMediaCategory);
        if (tabIndex !== -1) handleTabPress(tabIndex);
      } else {
        setMedia({ images: [], audios: [], videos: [], others: [] });
        const response = await fetch(link);
        const html = await response.text();
        const baseUrl = response.url;
        const extracted = extractMedia(html);
        setMedia({
          images: extracted.images.map(url => resolveUrl(baseUrl, url)).filter(Boolean),
          audios: extracted.audios.map(url => resolveUrl(baseUrl, url)).filter(Boolean),
          videos: extracted.videos.map(url => resolveUrl(baseUrl, url)).filter(Boolean),
          others: []
        });
        handleTabPress(0);
      }
    } catch (error) {
      console.error(error);
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

      Alert.alert(
        'Success!',
        `${filename} has been saved to your device's media library.`
      );

    } catch (e) {
      console.error(e);
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

  const renderContentForTab = (tabName: 'Image' | 'Audio' | 'Video' | 'Other') => {
    const dataMap = { Image: media.images, Audio: media.audios, Video: media.videos, Other: media.others };
    const dataToRender = dataMap[tabName];

    if (dataToRender.length === 0) {
      return <Text style={styles.noResultsText}>No {tabName.toLowerCase()}s found.</Text>
    }

    return dataToRender.map((url, index) => {
      const downloadInfo = downloads[url];

      return (
        <View key={`${url}-${index}`} style={styles.resultItemContainer}>
          <View style={styles.resultItem}>
            {tabName === 'Image' && (
              <Image source={{ uri: url }} style={styles.thumbnail} resizeMode="cover" />
            )}
            <Text style={styles.linkText} selectable numberOfLines={2} ellipsizeMode="middle">{url}</Text>
            <Pressable
              style={styles.downloadButton}
              onPress={() => handleDownload(url, tabName)}
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
    });
  };

  const translateX = animation.interpolate({
    inputRange: TABS.map((_, i) => i),
    outputRange: TABS.map((_, i) => -i * contentWidth),
    extrapolate: 'clamp',
  });

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
            const mediaCounts = { Image: media.images.length, Audio: media.audios.length, Video: media.videos.length, Other: media.others.length };
            const count = mediaCounts[tabName as keyof typeof mediaCounts];
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
            {TABS.map((tabName) => (
              <ScrollView key={tabName} style={{ width: contentWidth }} contentContainerStyle={styles.results}>
                {renderContentForTab(tabName as any)}
              </ScrollView>
            ))}
          </Animated.View>
        )}
      </View>
      <StatusBar style="auto" />
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
});

const hStyles = StyleSheet.create({
  h1: { fontWeight: 'bold', fontSize: 32, marginTop: 24, marginBottom: 16 },
  h2: { fontWeight: 'bold', fontSize: 24, marginTop: 20, marginBottom: 14 },
  h3: { fontWeight: 'bold', fontSize: 18.72, marginTop: 16, marginBottom: 12 },
  h4: { fontWeight: 'bold', fontSize: 16, marginTop: 14, marginBottom: 10 },
  h5: { fontWeight: 'bold', fontSize: 13.28, marginTop: 12, marginBottom: 8 },
  h6: { fontWeight: 'bold', fontSize: 10.72, marginTop: 10, marginBottom: 6 },
});