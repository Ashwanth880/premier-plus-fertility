import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  StatusBar,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Constants from 'expo-constants';

// Helper to auto-detect computer host IP when running in Expo Go
const getDevHost = () => {
  try {
    const hostUri =
      Constants.expoConfig?.hostUri ||
      Constants.manifest?.debuggerHost ||
      Constants.manifest2?.extra?.expoGo?.developer?.tool;
    if (hostUri) {
      const ip = hostUri.split(':')[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
        return ip;
      }
    }
  } catch (e) {
    console.warn('Could not auto-detect hostUri:', e);
  }
  return '192.168.1.6'; // Default detected Wi-Fi IP
};

const DETECTED_IP = getDevHost();
const DEFAULT_URL = `http://${DETECTED_IP}:3000`;

export default function AppNative() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [inputUrl, setInputUrl] = useState(DEFAULT_URL);
  const [showConfig, setShowConfig] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [errorDetails, setErrorDetails] = useState('');
  const webViewRef = useRef(null);

  const handleReload = () => {
    setLoadError(false);
    setLoading(true);
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  };

  const handleApplyUrl = (targetUrl) => {
    let formatted = (targetUrl || inputUrl).trim();
    if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
      formatted = 'http://' + formatted;
    }
    setUrl(formatted);
    setInputUrl(formatted);
    setLoadError(false);
    setLoading(true);
    setShowConfig(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F766E" />

      {/* Top Header Bar */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Premier Plus Clinic</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.configBtn} onPress={() => setShowConfig(!showConfig)}>
            <Text style={styles.configBtnText}>{showConfig ? 'Close' : '⚙ Server'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.reloadBtn} onPress={handleReload}>
            <Text style={styles.reloadBtnText}>🔄</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* URL Config Drawer */}
      {showConfig && (
        <View style={styles.configDrawer}>
          <Text style={styles.label}>Server URL (Host IP:Port):</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={inputUrl}
              onChangeText={setInputUrl}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={`http://${DETECTED_IP}:3000`}
            />
            <TouchableOpacity style={styles.applyBtn} onPress={() => handleApplyUrl(inputUrl)}>
              <Text style={styles.applyBtnText}>Connect</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.presetRow}>
            <TouchableOpacity
              style={styles.presetChip}
              onPress={() => handleApplyUrl(`http://${DETECTED_IP}:3000`)}
            >
              <Text style={styles.presetText}>Wi-Fi IP ({DETECTED_IP})</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.presetChip}
              onPress={() => handleApplyUrl('http://10.0.2.2:3000')}
            >
              <Text style={styles.presetText}>Emulator (10.0.2.2)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.presetChip}
              onPress={() => handleApplyUrl('http://localhost:3000')}
            >
              <Text style={styles.presetText}>Localhost</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Main WebView Container */}
      <View style={styles.webContainer}>
        {loadError ? (
          <ScrollView contentContainerStyle={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Cannot Connect to Server</Text>
            <Text style={styles.errorMsg}>
              Could not load Premier Plus web app at:{'\n'}
              <Text style={styles.urlHighlight}>{url}</Text>
            </Text>

            {errorDetails ? (
              <View style={styles.detailsBox}>
                <Text style={styles.detailsText}>{errorDetails}</Text>
              </View>
            ) : null}

            <View style={styles.troubleCard}>
              <Text style={styles.troubleHeader}>Troubleshooting Steps:</Text>
              <Text style={styles.stepText}>1. Make sure your local server is running on PC (`npm run dev` or `npm run dev` in terminal).</Text>
              <Text style={styles.stepText}>2. Ensure mobile phone and PC are connected to the same Wi-Fi network.</Text>
              <Text style={styles.stepText}>3. Verify host IP matches your PC Wi-Fi address ({DETECTED_IP}).</Text>
            </View>

            <TouchableOpacity style={styles.retryBtn} onPress={handleReload}>
              <Text style={styles.retryBtnText}>🔄 Retry Connection</Text>
            </TouchableOpacity>

            <View style={styles.presetSection}>
              <Text style={styles.presetHeader}>Quick Switch Server Address:</Text>
              <TouchableOpacity
                style={styles.bigPresetBtn}
                onPress={() => handleApplyUrl(`http://${DETECTED_IP}:3000`)}
              >
                <Text style={styles.bigPresetText}>Use PC Wi-Fi IP: http://{DETECTED_IP}:3000</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.bigPresetBtn}
                onPress={() => handleApplyUrl('http://10.0.2.2:3000')}
              >
                <Text style={styles.bigPresetText}>Use Android Emulator: http://10.0.2.2:3000</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          <WebView
            ref={webViewRef}
            source={{ uri: url }}
            style={styles.webview}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#0F766E" />
                <Text style={styles.loadingText}>Loading Premier Plus Clinic...</Text>
                <Text style={styles.loadingSubtext}>{url}</Text>
              </View>
            )}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.warn('WebView error:', nativeEvent);
              setLoadError(true);
              setErrorDetails(nativeEvent.description || 'Network connection failed or address unreachable.');
            }}
            onHttpError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              if (nativeEvent.statusCode >= 400) {
                setLoadError(true);
                setErrorDetails(`HTTP Error ${nativeEvent.statusCode}: ${nativeEvent.description || 'Server returned error status'}`);
              }
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F766E',
  },
  header: {
    height: 52,
    backgroundColor: '#0F766E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 17,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  configBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  configBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  reloadBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  reloadBtnText: {
    fontSize: 14,
  },
  configDrawer: {
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
  },
  label: {
    fontSize: 12,
    color: '#334155',
    marginBottom: 6,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  input: {
    flex: 1,
    height: 40,
    borderColor: '#CBD5E1',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 14,
    color: '#0F172A',
  },
  applyBtn: {
    backgroundColor: '#0F766E',
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  presetChip: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 4,
  },
  presetText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
  },
  webContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#0F766E',
    fontWeight: '600',
  },
  loadingSubtext: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748B',
  },
  errorContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMsg: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
  },
  urlHighlight: {
    fontWeight: 'bold',
    color: '#0F766E',
  },
  detailsBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    width: '100%',
    marginBottom: 16,
  },
  detailsText: {
    fontSize: 12,
    color: '#991B1B',
  },
  troubleCard: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 14,
    width: '100%',
    marginBottom: 20,
  },
  troubleHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  stepText: {
    fontSize: 13,
    color: '#334155',
    marginBottom: 6,
    lineHeight: 18,
  },
  retryBtn: {
    backgroundColor: '#0F766E',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 24,
    width: '100%',
    alignItems: 'center',
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  presetSection: {
    width: '100%',
  },
  presetHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  bigPresetBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
  },
  bigPresetText: {
    fontSize: 13,
    color: '#0F766E',
    fontWeight: '600',
  },
});
