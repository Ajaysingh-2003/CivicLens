import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../services/AuthContext';

export default function HomeScreen() {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <Ionicons name="location-outline" size={60} color="#4CAF50" />
      <Text style={styles.title}>CivicLens Mobile</Text>
      <Text style={styles.welcome}>Welcome, {user?.name || user?.full_name || 'Citizen'}!</Text>
      <Text style={styles.role}>Role: {user?.title || user?.role}</Text>

      <View style={styles.card}>
        <Text style={styles.cardText}>You are logged in securely via JWT. Ready for field reporting tools.</Text>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Ionicons name="log-out-outline" size={20} color="#D32F2F" />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  welcome: {
    fontSize: 18,
    color: '#555',
    marginTop: 8,
  },
  role: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  card: {
    marginTop: 32,
    backgroundColor: '#f5f5f5',
    padding: 20,
    borderRadius: 8,
    width: '100%',
  },
  cardText: {
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 40,
    padding: 12,
    borderWidth: 1,
    borderColor: '#D32F2F',
    borderRadius: 8,
  },
  logoutText: {
    color: '#D32F2F',
    marginLeft: 8,
    fontWeight: 'bold',
  },
});
