import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Image, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useAuth } from '../services/AuthContext';

export default function OtpScreen({ route, navigation }: any) {
  const { email, purpose } = route.params; // purpose: 'register' | 'login'
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [timeLeft, setTimeLeft] = useState(60);
  const [resending, setResending] = useState(false);
  
  const { refreshUser } = useAuth();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (timeLeft > 0) {
      const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timerId);
    }
  }, [timeLeft]);

  const handleVerify = async () => {
    if (code.length < 6) {
      setError("Please enter the 6-digit code.");
      return;
    }

    setLoading(true);
    setError('');

    try {
      let data;
      if (purpose === 'register') {
        data = await api.verifyRegisterOtp(email, code);
      } else {
        data = await api.verifyLoginOtp(email, code);
      }
      
      // After getting token, we fetch user profile to complete login
      await refreshUser();
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (timeLeft > 0) return;
    
    setResending(true);
    setError('');
    
    try {
      await api.resendOtp(email, purpose);
      setTimeLeft(60);
      Alert.alert("Success", "A new OTP has been sent to your email.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>Verification Required</Text>
          <Text style={styles.subtitle}>We've sent a 6-digit code to</Text>
          <Text style={styles.emailText}>{email}</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="warning" size={20} color="#D32F2F" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.otpContainer}>
          {/* Render 6 beautiful boxes */}
          {Array(6).fill(0).map((_, i) => (
            <TouchableOpacity 
              key={i} 
              activeOpacity={1}
              onPress={() => inputRef.current?.focus()}
              style={[
                styles.otpBox, 
                code.length === i && styles.otpBoxActive,
                code.length > i && styles.otpBoxFilled
              ]}
            >
              <Text style={styles.otpText}>{code[i] || ''}</Text>
            </TouchableOpacity>
          ))}
          
          {/* Hidden input to handle the actual typing */}
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={(text) => setCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="numeric"
            style={styles.hiddenInput}
            autoFocus
          />
        </View>

        <TouchableOpacity style={styles.button} onPress={handleVerify} disabled={loading || code.length < 6}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Verify OTP</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          {timeLeft > 0 ? (
            <Text style={styles.footerText}>
              Resend code in <Text style={{fontWeight: 'bold'}}>0:{timeLeft.toString().padStart(2, '0')}</Text>
            </Text>
          ) : (
            <TouchableOpacity onPress={handleResend} disabled={resending}>
              {resending ? (
                 <ActivityIndicator color="#4CAF50" size="small" />
              ) : (
                 <Text style={styles.linkText}>Resend Code</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
        
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>Back to {purpose === 'register' ? 'Register' : 'Login'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  formContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 80,
    height: 100,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  emailText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 4,
  },
  errorBox: {
    flexDirection: 'row',
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  errorText: {
    color: '#D32F2F',
    marginLeft: 8,
    flex: 1,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    position: 'relative',
  },
  otpBox: {
    width: 45,
    height: 55,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  otpBoxActive: {
    borderColor: '#4CAF50',
    borderWidth: 2,
    backgroundColor: '#fff',
  },
  otpBoxFilled: {
    borderColor: '#aaa',
    backgroundColor: '#fff',
  },
  otpText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: '100%',
    height: '100%',
  },
  button: {
    backgroundColor: '#4CAF50',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    height: 20,
  },
  footerText: {
    color: '#666',
  },
  linkText: {
    color: '#4CAF50',
    fontWeight: 'bold',
    fontSize: 15,
  },
  backButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  backText: {
    color: '#666',
    textDecorationLine: 'underline',
  }
});
