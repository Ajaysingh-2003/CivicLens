import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView,
  Platform, ActivityIndicator, Image, ScrollView, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';

type Step = 'email' | 'otp' | 'reset';

export default function ForgotPasswordScreen({ navigation }: any) {
  const [step, setStep] = useState<Step>('email');

  // Step 1 state
  const [email, setEmail] = useState('');

  // Step 2 state
  const [otpCode, setOtpCode] = useState('');
  const [timeLeft, setTimeLeft] = useState(60);
  const [resending, setResending] = useState(false);
  const otpInputRef = useRef<TextInput>(null);

  // Step 3 state
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Common state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // OTP countdown timer
  useEffect(() => {
    if (step === 'otp' && timeLeft > 0) {
      const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timerId);
    }
  }, [step, timeLeft]);

  // ─── Step 1: Send OTP ──────────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.forgotPasswordSendOtp(email.trim());
      setTimeLeft(60);
      setStep('otp');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 2: Verify OTP ────────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (otpCode.length < 6) {
      setError('Please enter the 6-digit code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await api.forgotPasswordVerifyOtp(email, otpCode);
      setResetToken(data.reset_token);
      setStep('reset');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 2: Resend OTP ────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (timeLeft > 0) return;

    setResending(true);
    setError('');

    try {
      await api.resendOtp(email, 'forgot_password');
      setTimeLeft(60);
      setOtpCode('');
      Alert.alert('Success', 'A new OTP has been sent to your email.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  };

  // ─── Step 3: Reset Password ────────────────────────────────────────────────────
  const handleResetPassword = async () => {
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.forgotPasswordReset(email, resetToken, newPassword);
      Alert.alert(
        'Password Reset Successful',
        'Your password has been updated. Please login with your new password.',
        [{ text: 'Go to Login', onPress: () => navigation.navigate('Login') }]
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Render Steps ──────────────────────────────────────────────────────────────

  const renderEmailStep = () => (
    <>
      <Text style={styles.stepTitle}>Forgot your password?</Text>
      <Text style={styles.stepSubtitle}>
        Enter the email address linked to your account. We'll send you a code to reset your password.
      </Text>

      <View style={styles.inputbox}>
        <Ionicons name="mail-outline" size={20} color="#666" style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder="Email Address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoFocus
        />
      </View>

      <TouchableOpacity style={styles.button} onPress={handleSendOtp} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Send OTP</Text>
        )}
      </TouchableOpacity>
    </>
  );

  const renderOtpStep = () => (
    <>
      <Text style={styles.stepTitle}>Verification</Text>
      <Text style={styles.stepSubtitle}>We've sent a 6-digit code to</Text>
      <Text style={styles.emailHighlight}>{email}</Text>

      <View style={styles.otpContainer}>
        {Array(6).fill(0).map((_, i) => (
          <TouchableOpacity
            key={i}
            activeOpacity={1}
            onPress={() => otpInputRef.current?.focus()}
            style={[
              styles.otpBox,
              otpCode.length === i && styles.otpBoxActive,
              otpCode.length > i && styles.otpBoxFilled
            ]}
          >
            <Text style={styles.otpText}>{otpCode[i] || ''}</Text>
          </TouchableOpacity>
        ))}

        <TextInput
          ref={otpInputRef}
          value={otpCode}
          onChangeText={(text) => setOtpCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
          keyboardType="numeric"
          style={styles.hiddenInput}
          autoFocus
        />
      </View>

      <TouchableOpacity
        style={[styles.button, otpCode.length < 6 && styles.buttonDisabled]}
        onPress={handleVerifyOtp}
        disabled={loading || otpCode.length < 6}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Verify OTP</Text>
        )}
      </TouchableOpacity>

      <View style={styles.timerRow}>
        {timeLeft > 0 ? (
          <Text style={styles.timerText}>
            Resend code in <Text style={{ fontWeight: 'bold' }}>0:{timeLeft.toString().padStart(2, '0')}</Text>
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

      <TouchableOpacity onPress={() => { setStep('email'); setOtpCode(''); setError(''); }}>
        <Text style={styles.changeEmailText}>Wrong email? Go back</Text>
      </TouchableOpacity>
    </>
  );

  const renderResetStep = () => (
    <>
      <Text style={styles.stepTitle}>Create New Password</Text>
      <Text style={styles.stepSubtitle}>
        Your identity has been verified. Set your new password below.
      </Text>

      <View style={styles.inputbox}>
        <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder="New Password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry={!showNewPassword}
          autoFocus
        />
        <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
          <Ionicons name={showNewPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#666" />
        </TouchableOpacity>
      </View>

      <View style={styles.inputbox}>
        <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showConfirmPassword}
        />
        <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
          <Ionicons name={showConfirmPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#666" />
        </TouchableOpacity>
      </View>

      {newPassword.length > 0 && newPassword.length < 6 && (
        <Text style={styles.hintText}>Password must be at least 6 characters</Text>
      )}

      {confirmPassword.length > 0 && newPassword !== confirmPassword && (
        <Text style={styles.hintText}>Passwords do not match</Text>
      )}

      <TouchableOpacity
        style={[
          styles.button,
          (newPassword.length < 6 || newPassword !== confirmPassword) && styles.buttonDisabled
        ]}
        onPress={handleResetPassword}
        disabled={loading || newPassword.length < 6 || newPassword !== confirmPassword}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Reset Password</Text>
        )}
      </TouchableOpacity>
    </>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.formContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>CivicLens</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="warning" size={20} color="#D32F2F" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {step === 'email' && renderEmailStep()}
        {step === 'otp' && renderOtpStep()}
        {step === 'reset' && renderResetStep()}

        <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.backText}>Back to Login</Text>
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
    marginBottom: 24,
  },
  logo: {
    width: 80,
    height: 100,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },

  // Step Content
  stepTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A202C',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#718096',
    lineHeight: 20,
    marginBottom: 24,
  },
  emailHighlight: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 24,
  },

  // Input
  inputbox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    height: 50,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },

  // OTP
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
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

  // Buttons
  button: {
    backgroundColor: '#4CAF50',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    backgroundColor: '#A5D6A7',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Timer / Links
  timerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    height: 20,
  },
  timerText: {
    color: '#666',
  },
  linkText: {
    color: '#4CAF50',
    fontWeight: 'bold',
    fontSize: 15,
  },
  changeEmailText: {
    color: '#666',
    textDecorationLine: 'underline',
    textAlign: 'center',
    marginTop: 16,
  },

  // Hints
  hintText: {
    fontSize: 12,
    color: '#E53E3E',
    marginTop: -8,
    marginBottom: 12,
    paddingLeft: 4,
  },

  // Error
  errorBox: {
    flexDirection: 'row',
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  errorText: {
    color: '#D32F2F',
    marginLeft: 8,
    flex: 1,
  },

  // Back
  backButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  backText: {
    color: '#666',
    textDecorationLine: 'underline',
  },
});
