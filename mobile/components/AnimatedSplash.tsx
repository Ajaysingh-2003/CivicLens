import React, { useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, Animated, Easing } from 'react-native';

const LOGO = require('../assets/logo.png');
const SPLASH_DURATION = 3000;

export default function SplashScreen({ onFinish }: { onFinish?: () => void }) {
  const barWidth = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in the logo
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // Animate loading bar
    Animated.timing(barWidth, {
      toValue: 100,
      duration: SPLASH_DURATION,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();

    if (onFinish) {
      setTimeout(() => onFinish(), SPLASH_DURATION + 300);
    }
  }, []);

  const barAnimatedWidth = barWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoWrap, { opacity: fadeIn }]}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
      </Animated.View>

      {/* Loading bar */}
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { width: barAnimatedWidth }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoWrap: {
    marginBottom: 48,
  },
  logo: {
    width: 180,
    height: 220,
  },
  barTrack: {
    width: 200,
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 2,
  },
});
