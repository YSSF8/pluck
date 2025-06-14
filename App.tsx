import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TextInput, Image, Pressable, ScrollView, SafeAreaView } from 'react-native';
import React, { useState } from 'react';

export default function App() {
  const [isInputFocused, setIsInputFocused] = useState(false);

  const testData = Array.from({ length: 60 }, (_, i) => i + 1);

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
        />
        <View style={styles.buttonWrapper}>
          <Pressable
            android_ripple={{
              color: '#aaa',
              borderless: false,
              radius: 60
            }}
            style={styles.pluckButton}
          >
            <Text style={styles.text}>Pluck</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.resultContainer}>
        <View style={styles.tabContainer}>
          <Pressable
            android_ripple={{
              color: '#444',
              borderless: false,
              radius: 60
            }}
            style={styles.tab}
          >
            <Text style={styles.text}>Image</Text>
          </Pressable>
          <Pressable
            android_ripple={{
              color: '#444',
              borderless: false,
              radius: 60
            }}
            style={styles.tab}
          >
            <Text style={styles.text}>Audio</Text>
          </Pressable>
          <Pressable
            android_ripple={{
              color: '#444',
              borderless: false,
              radius: 60
            }}
            style={styles.tab}
          >
            <Text style={styles.text}>Video</Text>
          </Pressable>
          <Pressable
            android_ripple={{
              color: '#444',
              borderless: false,
              radius: 60
            }}
            style={styles.tab}
          >
            <Text style={styles.text}>Other</Text>
          </Pressable>
        </View>
        <ScrollView style={styles.results}>
          {testData.map(item => (
            <Text key={item} style={styles.testItem}>Item {item}</Text>
          ))}
        </ScrollView>
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
  },
  resultContainer: {
    flex: 1,
    width: '90%',
    backgroundColor: '#121212',
    overflow: 'hidden',
    borderRadius: variables.spacing,
    marginTop: variables.spacing * 3,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#121212',
    elevation: 12
  },
  tab: {
    padding: variables.spacing * 2,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  results: {
    flex: 1,
  },
  testItem: {
    color: 'white',
    padding: 10,
    fontSize: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333'
  }
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