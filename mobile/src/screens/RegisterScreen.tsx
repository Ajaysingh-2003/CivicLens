import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Modal, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { api } from '../services/api';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import ModerationRejectionModal from '../components/ModerationRejectionModal';

export default function RegisterScreen({ navigation }: any) {
  const { refreshUser } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);
  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  
  const [username, setUsername] = useState(`Citizen-${dateStr}-${Math.floor(Math.random() * 9999) + 1}`);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);

  const [selectedState, setSelectedState] = useState<number | ''>('');
  const [selectedCity, setSelectedCity] = useState<number | ''>('');

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [rejectionMessage, setRejectionMessage] = useState('');
  
  // Animation for the success tick mark
  const scaleAnim = useRef(new Animated.Value(0)).current;

  // Inline errors state
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (success) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }).start();
    }
  }, [success]);

  useEffect(() => {
    api.getStates().then(setStates).catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedState) {
      api.getCities(Number(selectedState)).then(setCities).catch(console.error);
    } else {
      setCities([]);
    }
    setSelectedCity('');
  }, [selectedState]);

  const validateUsername = (val: string) => {
    if (val.length < 3 || val.length > 30 || !/^[a-zA-Z0-9_.-]+$/.test(val)) {
      return "Username must be 3-30 characters (letters, numbers, _, -, .)";
    }
    return "";
  };

  const validateEmail = (val: string) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      return "Please enter a valid email address.";
    }
    return "";
  };

  const validatePassword = (val: string) => {
    if (val.length < 6) return "Password must be at least 6 characters long.";
    return "";
  };

  const handleRegister = async () => {
    let newErrors: Record<string, string> = {};

    const uErr = validateUsername(username);
    if (uErr) newErrors.username = uErr;
    
    const eErr = validateEmail(email);
    if (eErr) newErrors.email = eErr;

    const pErr = validatePassword(password);
    if (pErr) newErrors.password = pErr;

    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
    }

    if (!selectedState) newErrors.state = "State is required.";
    if (!selectedCity) newErrors.city = "City is required.";

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      // Focus the top-most error roughly by scrolling to top
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;

      // Sync the user to our Postgres DB (role is hardcoded server-side as CITIZEN)
      // Pass the token directly because getSession() might have an async delay
      await api.syncUser(email, username, Number(selectedCity), data.session?.access_token);

      setSuccess(true);
      // Delay the refresh User call until the user clicks the button on the success modal
      // await refreshUser();
    } catch (err: any) {
      const msg = err.message || "Registration failed";
      if (msg.includes('inappropriate') || msg.includes('taken')) {
        setRejectionMessage(msg);
      } else {
        // Map common backend and Supabase errors to fields
        if (msg.toLowerCase().includes('security reason') || msg.toLowerCase().includes('rate limit')) {
          setErrors(prev => ({ ...prev, email: "Too many attempts. Please wait a minute before trying again." }));
        } else if (msg.toLowerCase().includes('email')) {
          setErrors(prev => ({ ...prev, email: msg }));
        } else if (msg.toLowerCase().includes('username')) {
          setErrors(prev => ({ ...prev, username: msg }));
        } else {
          // generic fallback to email field since we removed top error box
          setErrors(prev => ({ ...prev, email: msg }));
        }
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView ref={scrollViewRef} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Join CivicLens</Text>
          <Text style={styles.subtitle}>Register your field reporting account.</Text>
        </View>

        <Modal
          visible={success}
          transparent={true}
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Animated.View style={[styles.modalIconContainer, { transform: [{ scale: scaleAnim }] }]}>
                <Ionicons name="checkmark" size={40} color="#fff" />
              </Animated.View>
              <Text style={styles.modalTitle}>Welcome to CivicLens</Text>
              <Text style={styles.modalText}>
                Your account has been successfully created. Thank you for joining our community.
              </Text>
              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => {
                  setSuccess(false);
                  setTimeout(() => {
                    refreshUser();
                  }, 100);
                }}
              >
                <Text style={styles.modalButtonText}>Get Started</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Username *</Text>
          <View style={[styles.inputbox, errors.username ? styles.inputError : null]}>
            <Ionicons name="person-outline" size={20} color={errors.username ? "#D32F2F" : "#666"} style={styles.icon} />
            <TextInput 
              style={styles.input} 
              placeholder="e.g. Citizen-20260510-42" 
              value={username} 
              onChangeText={(val) => {
                setUsername(val);
                setErrors(prev => ({ ...prev, username: validateUsername(val) }));
              }} 
              autoCapitalize="none" 
            />
          </View>
          {errors.username ? (
            <Text style={styles.inlineErrorText}>{errors.username}</Text>
          ) : (
            <Text style={styles.fieldHint}>Auto-generated for your privacy. Feel free to change it!</Text>
          )}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email Address *</Text>
          <View style={[styles.inputbox, errors.email ? styles.inputError : null]}>
            <Ionicons name="mail-outline" size={20} color={errors.email ? "#D32F2F" : "#666"} style={styles.icon} />
            <TextInput 
              style={styles.input} 
              placeholder="name@example.com" 
              value={email} 
              onChangeText={(val) => {
                setEmail(val);
                setErrors(prev => ({ ...prev, email: validateEmail(val) }));
              }} 
              keyboardType="email-address" 
              autoCapitalize="none" 
            />
          </View>
          {errors.email ? <Text style={styles.inlineErrorText}>{errors.email}</Text> : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>State *</Text>
          <View style={[styles.pickerContainer, errors.state ? styles.inputError : null]}>
            <Picker 
              selectedValue={selectedState} 
              onValueChange={(val) => {
                setSelectedState(val as number);
                setErrors(prev => ({ ...prev, state: val ? '' : 'State is required.' }));
              }}
            >
              <Picker.Item label="Select State..." value="" />
              {states.map(state => (
                <Picker.Item key={state.id} label={state.name} value={state.id} />
              ))}
            </Picker>
          </View>
          {errors.state ? <Text style={styles.inlineErrorText}>{errors.state}</Text> : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>City / District *</Text>
          <View style={[styles.pickerContainer, errors.city ? styles.inputError : null]}>
            <Picker 
              selectedValue={selectedCity} 
              onValueChange={(val) => {
                setSelectedCity(val as number);
                setErrors(prev => ({ ...prev, city: val ? '' : 'City is required.' }));
              }} 
              enabled={!!selectedState}
            >
              <Picker.Item label={selectedState ? "Select City..." : "Select State First"} value="" />
              {cities.map(city => (
                <Picker.Item key={city.id} label={city.name} value={city.id} />
              ))}
            </Picker>
          </View>
          {errors.city ? <Text style={styles.inlineErrorText}>{errors.city}</Text> : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Set Password *</Text>
          <View style={[styles.inputbox, errors.password ? styles.inputError : null]}>
            <Ionicons name="lock-closed-outline" size={20} color={errors.password ? "#D32F2F" : "#666"} style={styles.icon} />
            <TextInput 
              style={styles.input} 
              placeholder="Create strong password" 
              value={password} 
              onChangeText={(val) => {
                setPassword(val);
                setErrors(prev => ({ ...prev, password: validatePassword(val) }));
                if (confirmPassword && val !== confirmPassword) {
                  setErrors(prev => ({ ...prev, confirmPassword: "Passwords do not match." }));
                } else {
                  setErrors(prev => ({ ...prev, confirmPassword: "" }));
                }
              }} 
              secureTextEntry={!showPassword} 
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#666" />
            </TouchableOpacity>
          </View>
          {errors.password ? <Text style={styles.inlineErrorText}>{errors.password}</Text> : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Confirm Password *</Text>
          <View style={[styles.inputbox, errors.confirmPassword ? styles.inputError : null]}>
            <Ionicons name="key-outline" size={20} color={errors.confirmPassword ? "#D32F2F" : "#666"} style={styles.icon} />
            <TextInput 
              style={styles.input} 
              placeholder="Repeat password" 
              value={confirmPassword} 
              onChangeText={(val) => {
                setConfirmPassword(val);
                if (password !== val) {
                  setErrors(prev => ({ ...prev, confirmPassword: "Passwords do not match." }));
                } else {
                  setErrors(prev => ({ ...prev, confirmPassword: "" }));
                }
              }} 
              secureTextEntry={!showConfirmPassword} 
            />
            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
              <Ionicons name={showConfirmPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#666" />
            </TouchableOpacity>
          </View>
          {errors.confirmPassword ? <Text style={styles.inlineErrorText}>{errors.confirmPassword}</Text> : null}
        </View>

        <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading || success}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Register Account</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.linkText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ModerationRejectionModal
        visible={!!rejectionMessage}
        onClose={() => setRejectionMessage('')}
        message={rejectionMessage}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 48,
    paddingBottom: 60,
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
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
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
  },
  inputbox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 50,
  },
  inputError: {
    borderColor: '#D32F2F',
    borderWidth: 1.5,
  },
  inlineErrorText: {
    color: '#D32F2F',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#4CAF50',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
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
  },
  footerText: {
    color: '#666',
  },
  linkText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  fieldHint: {
    fontSize: 12,
    color: '#888',
    marginTop: 6,
    marginLeft: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)', // Solid opaque white to hide form fields behind
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
