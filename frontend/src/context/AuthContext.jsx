import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, userAPI } from '../utils/api';
import {
  generateRSAKeyPair,
  exportPublicKey,
  exportPrivateKey,
  importPrivateKey,
  encryptPrivateKeyWithPassword,
  decryptPrivateKeyWithPassword,
} from '../utils/crypto';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [privateKey, setPrivateKey] = useState(null);

  // Check if user is logged in on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    const storedEncryptedPrivateKey = localStorage.getItem('encryptedPrivateKey');

    if (token && storedUser) {
      try {
        const response = await authAPI.getMe();
        setUser(response.data);

        // If encrypted private key exists, user needs to decrypt it with password
        // For now, we'll load it when they decrypt it
        if (storedEncryptedPrivateKey) {
          // Private key will be loaded when user provides password
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        logout();
      }
    }
    setLoading(false);
  };

  const register = async (name, email, password) => {
    try {
      const response = await authAPI.register({ name, email, password });
      const { token, ...userData } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);

      // Generate keys after registration
      await initializeKeys(password);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Registration failed',
      };
    }
  };

  const login = async (email, password) => {
    try {
      const response = await authAPI.login({ email, password });
      const { token, ...userData } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);

      // Load or generate keys
      await loadOrGenerateKeys(password);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Login failed',
      };
    }
  };

  const initializeKeys = async (password) => {
    try {
      // Generate RSA key pair
      const keyPair = await generateRSAKeyPair();

      // Export keys
      const publicKeyPEM = await exportPublicKey(keyPair.publicKey);
      const privateKeyPEM = await exportPrivateKey(keyPair.privateKey);

      // Encrypt private key with password
      const encryptedPrivateKey = await encryptPrivateKeyWithPassword(
        privateKeyPEM,
        password
      );

      // Store encrypted private key locally
      localStorage.setItem('encryptedPrivateKey', encryptedPrivateKey);

      // Upload public key to server
      await userAPI.updatePublicKey(publicKeyPEM);

      // Store private key in memory (decrypted)
      setPrivateKey(keyPair.privateKey);

      return { success: true };
    } catch (error) {
      console.error('Error initializing keys:', error);
      return { success: false, message: 'Failed to initialize encryption keys' };
    }
  };

  const loadOrGenerateKeys = async (password) => {
    try {
      const storedEncryptedPrivateKey = localStorage.getItem('encryptedPrivateKey');

      if (storedEncryptedPrivateKey) {
        // Decrypt and load existing private key
        const privateKeyPEM = await decryptPrivateKeyWithPassword(
          storedEncryptedPrivateKey,
          password
        );
        const privateKey = await importPrivateKey(privateKeyPEM);
        setPrivateKey(privateKey);
      } else {
        // Generate new keys if they don't exist
        await initializeKeys(password);
      }
    } catch (error) {
      console.error('Error loading keys:', error);
      throw new Error('Failed to load encryption keys. Incorrect password?');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('encryptedPrivateKey');
    setUser(null);
    setPrivateKey(null);
  };

  const value = {
    user,
    privateKey,
    loading,
    register,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

