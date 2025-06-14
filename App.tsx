import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TextInput, Image, Pressable, ScrollView, SafeAreaView, ActivityIndicator, Alert, Animated, Dimensions } from 'react-native';
import React, { useState, useRef } from 'react';
import { extractMedia } from './lib/parser';

type Media = {
  images: string[];
  audios: string[];
  videos: string[];
  others: string[];
};

const TABS = ['Image', 'Audio', 'Video', 'Other'];
const { width } = Dimensions.get('window');
const contentWidth = width * 0.9;


export default function App() {
  const [isInputFocused, setIsInputFocused] = useState(false);

  const [link, setLink] = useState('');
  const [media, setMedia] = useState<Media>({ images: [], audios: [], videos: [], others: [] });
  const [isLoading, setIsLoading] = useState(false);

  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const animation = useRef(new Animated.Value(0)).current;


  const resolveUrl = (baseUrl: string, relativeUrl: string): string => {
    if (!relativeUrl) return '';
    if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
      return relativeUrl;
    }
    if (relativeUrl.startsWith('//')) {
      return `https:${relativeUrl}`;
    }
    try {
      return new URL(relativeUrl, baseUrl).href;
    } catch (e) {
      console.error(`Could not resolve URL: ${relativeUrl} with base: ${baseUrl}`);
      return '';
    }
  };

  const handlePluck = async () => {
    if (!link.trim()) {
      Alert.alert("Error", "Please paste a link first.");
      return;
    }
    setIsLoading(true);
    setMedia({ images: [], audios: [], videos: [], others: [] });

    try {
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

    } catch (error) {
      console.error(error);
      Alert.alert("Failed to pluck", "Could not fetch or parse the link. Please check the URL and your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabPress = (index: number) => {
    setActiveTabIndex(index);
    Animated.spring(animation, {
      toValue: index,
      useNativeDriver: true,
      bounciness: 2,
    }).start();
  };

  const renderContentForTab = (tabName: 'Image' | 'Audio' | 'Video' | 'Other') => {
    const dataMap = {
      Image: media.images,
      Audio: media.audios,
      Video: media.videos,
      Other: media.others
    };
    const dataToRender = dataMap[tabName];

    if (dataToRender.length === 0) {
      return <Text style={styles.noResultsText}>No {tabName.toLowerCase()}s found.</Text>
    }

    if (tabName === 'Image') {
      return dataToRender.map((url, index) => (
        <View key={`${url}-${index}`} style={styles.resultItem}>
          <Image source={{ uri: url }} style={styles.thumbnail} resizeMode="cover" />
          <Text style={styles.linkText} selectable>{url}</Text>
        </View>
      ));
    }

    return dataToRender.map((url, index) => (
      <View key={`${url}-${index}`} style={styles.resultItem}>
        <Text style={styles.linkText} selectable>{url}</Text>
      </View>
    ));
  };

  const translateX = animation.interpolate({
    inputRange: TABS.map((_, i) => i),
    outputRange: TABS.map((_, i) => -i * contentWidth),
    extrapolate: 'clamp',
  });

  return (
    <SafeAreaView style={styles.container}>
      <Image
        source={require('./assets/icon.png')}
        style={{ width: 100, height: 100, borderRadius: 50 }}
      />
      <Text
        style={[styles.text, hStyles.h2, { marginBottom: 30 }]}>See it? Pluck it.</Text>
      <View style={styles.inputForm}>
        <TextInput
          style={[
            styles.input,
            isInputFocused ? styles.inputFocus : null
          ]}
          placeholder="Paste link..."
          placeholderTextColor="gray"
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={() => setIsInputFocused(true)}
          onBlur={() => setIsInputFocused(false)}
          onChangeText={setLink}
          value={link}
        />
        <View style={styles.buttonWrapper}>
          <Pressable
            android_ripple={{ color: '#aaa', borderless: false, radius: 60 }}
            style={styles.pluckButton}
            onPress={handlePluck}
            disabled={isLoading}
          >
            {isLoading ? <ActivityIndicator color="white" /> : <Text style={styles.text}>Pluck</Text>}
          </Pressable>
        </View>
      </View>

      <View style={styles.resultContainer}>
        <View style={styles.tabContainer}>
          {TABS.map((tabName, index) => {
            const mediaCounts = {
              Image: media.images.length,
              Audio: media.audios.length,
              Video: media.videos.length,
              Other: media.others.length
            };
            const count = mediaCounts[tabName as keyof typeof mediaCounts];

            return (
              <Pressable
                key={tabName}
                android_ripple={{ color: '#444', borderless: false }}
                onPress={() => handleTabPress(index)}
                style={[styles.tab, activeTabIndex === index && styles.activeTab]}>
                <Text style={styles.text}>{`${tabName} (${count})`}</Text>
              </Pressable>
            )
          })}
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={variables.accent} style={{ marginTop: 40 }} />
        ) : (
          <Animated.View style={[styles.animatedContent, { transform: [{ translateX }] }]}>
            {TABS.map((tabName) => (
              <ScrollView
                key={tabName}
                style={{ width: contentWidth }}
                contentContainerStyle={styles.results}
              >
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
    paddingBottom: 20,
  },
  text: {
    color: 'white'
  },
  inputForm: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '90%',
    justifyContent: 'space-between',
  },
  input: {
    height: 40,
    flex: 1,
    marginRight: variables.spacing,
    borderColor: 'gray',
    borderWidth: 1,
    borderRadius: variables.spacing,
    paddingHorizontal: 10,
    color: 'white',
  },
  inputFocus: {
    borderColor: variables.accent,
  },
  buttonWrapper: {
    borderRadius: variables.spacing,
    overflow: 'hidden',
    height: 40,
  },
  pluckButton: {
    backgroundColor: variables.accent,
    paddingVertical: variables.spacing,
    paddingHorizontal: variables.spacing * 2,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minWidth: 70,
  },
  resultContainer: {
    flex: 1,
    width: '90%',
    backgroundColor: '#121212',
    overflow: 'hidden',
    borderRadius: variables.spacing * 2,
    marginTop: variables.spacing * 3,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1e1e1e',
    elevation: 4,
    zIndex: 1,
  },
  tab: {
    padding: variables.spacing * 2,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: variables.accent,
  },
  animatedContent: {
    flex: 1,
    flexDirection: 'row',
    width: contentWidth * TABS.length,
  },
  results: {
    padding: variables.spacing,
  },
  noResultsText: {
    color: 'gray',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
  },
  resultItem: {
    backgroundColor: '#282828',
    padding: variables.spacing,
    borderRadius: variables.spacing,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: variables.spacing
  },
  thumbnail: {
    width: 50,
    height: 50,
    borderRadius: variables.spacing / 2,
    marginRight: variables.spacing * 1.5,
    backgroundColor: '#444'
  },
  linkText: {
    color: '#eee',
    flex: 1,
  },
});

const hStyles = StyleSheet.create({
  h1: {
    fontWeight: 'bold',
    fontSize: 32,
    marginTop: 24,
    marginBottom: 16,
  },
  h2: {
    fontWeight: 'bold',
    fontSize: 24,
    marginTop: 20,
    marginBottom: 14,
  },
  h3: {
    fontWeight: 'bold',
    fontSize: 18.72,
    marginTop: 16,
    marginBottom: 12,
  },
  h4: {
    fontWeight: 'bold',
    fontSize: 16,
    marginTop: 14,
    marginBottom: 10,
  },
  h5: {
    fontWeight: 'bold',
    fontSize: 13.28,
    marginTop: 12,
    marginBottom: 8,
  },
  h6: {
    fontWeight: 'bold',
    fontSize: 10.72,
    marginTop: 10,
    marginBottom: 6,
  },
});