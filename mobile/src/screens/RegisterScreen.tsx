import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { api } from '../services/api';

export default function RegisterScreen({ navigation }: any) {
  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const [username, setUsername] = useState(`Citizen-${dateStr}-${Math.floor(Math.random() * 9999) + 1}`);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('CITIZEN');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  const [selectedState, setSelectedState] = useState<number | ''>('');
  const [selectedCity, setSelectedCity] = useState<number | ''>('');
  const [selectedDepartment, setSelectedDepartment] = useState<number | ''>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.getStates().then(setStates).catch(console.error);
    api.getDepartments().then(setDepartments).catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedState) {
      api.getCities(Number(selectedState)).then(setCities).catch(console.error);
    } else {
      setCities([]);
    }
    setSelectedCity('');
  }, [selectedState]);

  const handleRegister = async () => {
    if (!username || !email || !password || !selectedState || !selectedCity) {
      setError("Please fill out all required fields.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (role === 'NGO_ADMIN' && !selectedDepartment) {
      setError("Please select a department for NGO Worker.");
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.register(
        email,
        password,
        username,
        role,
        Number(selectedState),
        Number(selectedCity),
        role === 'NGO_ADMIN' && selectedDepartment ? Number(selectedDepartment) : undefined
      );
      setSuccess(true);
      setTimeout(() => {
        navigation.navigate('OtpScreen', { email, purpose: 'register' });
      }, 1000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Join CivicLens</Text>
          <Text style={styles.subtitle}>Register your field reporting account.</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="warning" size={20} color="#D32F2F" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {success ? (
          <View style={[styles.errorBox, { backgroundColor: '#E8F5E9' }]}>
            <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
            <Text style={[styles.errorText, { color: '#4CAF50' }]}>Account created! Redirecting to login...</Text>
          </View>
        ) : null}

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Username *</Text>
          <View style={styles.inputbox}>
            <Ionicons name="person-outline" size={20} color="#666" style={styles.icon} />
            <TextInput style={styles.input} placeholder="e.g. Citizen-20260510-42" value={username} onChangeText={setUsername} autoCapitalize="none" />
          </View>
          <Text style={styles.fieldHint}>Auto-generated for your privacy. Feel free to change it!</Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email Address *</Text>
          <View style={styles.inputbox}>
            <Ionicons name="mail-outline" size={20} color="#666" style={styles.icon} />
            <TextInput style={styles.input} placeholder="name@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Account Role *</Text>
          <View style={styles.pickerContainer}>
            <Picker selectedValue={role} onValueChange={(itemValue) => setRole(itemValue)}>
              <Picker.Item label="Citizen" value="CITIZEN" />
              <Picker.Item label="NGO Worker" value="NGO_ADMIN" />
            </Picker>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>State *</Text>
          <View style={styles.pickerContainer}>
            <Picker selectedValue={selectedState} onValueChange={(val) => setSelectedState(val as number)}>
              <Picker.Item label="Select State..." value="" />
              {states.map(state => (
                <Picker.Item key={state.id} label={state.name} value={state.id} />
              ))}
            </Picker>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>City / District *</Text>
          <View style={styles.pickerContainer}>
            <Picker selectedValue={selectedCity} onValueChange={(val) => setSelectedCity(val as number)} enabled={!!selectedState}>
              <Picker.Item label={selectedState ? "Select City..." : "Select State First"} value="" />
              {cities.map(city => (
                <Picker.Item key={city.id} label={city.name} value={city.id} />
              ))}
            </Picker>
          </View>
        </View>

        {role === 'NGO_ADMIN' && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Department *</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={selectedDepartment} onValueChange={(val) => setSelectedDepartment(val as number)}>
                <Picker.Item label="Select Department..." value="" />
                {departments.map(dept => (
                  <Picker.Item key={dept.id} label={dept.name} value={dept.id} />
                ))}
              </Picker>
            </View>
          </View>
        )}

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Set Password *</Text>
          <View style={styles.inputbox}>
            <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.icon} />
            <TextInput style={styles.input} placeholder="Create strong password" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Confirm Password *</Text>
          <View style={styles.inputbox}>
            <Ionicons name="key-outline" size={20} color="#666" style={styles.icon} />
            <TextInput style={styles.input} placeholder="Repeat password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showConfirmPassword} />
            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
              <Ionicons name={showConfirmPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#666" />
            </TouchableOpacity>
          </View>
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
});
