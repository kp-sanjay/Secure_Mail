import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, kmsAPI, userAPI } from '../utils/api';
import {
  generateRSAKeyPair,
  exportPublicKey,
  exportPrivateKey,
  importPrivateKey,
  encryptPrivateKeyWithPassword,
  decryptPrivateKeyWithPassword,
} from '../utils/crypto';
import { mlkemGenerateKeyPairBase64 } from '../utils/pqc';

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
  const [mlkemSecretKeyB64, setMlkemSecretKeyB64] = useState(null);

  // Check if user is logged in on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const secureStoreGet = async (name) => {
    try {
      if (window?.electronAPI?.secureStore?.get) {
        return await window.electronAPI.secureStore.get(name);
      }
    } catch {
      // ignore
    }
    return null;
  };

  const secureStoreSet = async (name, value) => {
    try {
      if (window?.electronAPI?.secureStore?.set) {
        await window.electronAPI.secureStore.set(name, value);
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  };

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    const storedEncryptedPrivateKey = localStorage.getItem('encryptedPrivateKey');
    const storedEncryptedKeyBundle = localStorage.getItem('encryptedKeyBundleV1');

    if (token && storedUser) {
      try {
        const response = await authAPI.getMe();
        setUser(response.data);

        // If running in Electron, mirror secure-store key bundle into localStorage
        if (!storedEncryptedKeyBundle) {
          const fromKeychain = await secureStoreGet('encryptedKeyBundleV1');
          if (fromKeychain) {
            localStorage.setItem('encryptedKeyBundleV1', fromKeychain);
          }
        }

        // If encrypted private key exists, user needs to decrypt it with password
        // For now, we'll load it when they decrypt it
        if (storedEncryptedKeyBundle || storedEncryptedPrivateKey) {
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

      // Generate ML-KEM (Kyber/ML-KEM-768) key pair for Level 4
      const { publicKeyB64: mlkemPublicKey, secretKeyB64: mlkemSecretKey } =
        await mlkemGenerateKeyPairBase64();

      // Encrypt a key bundle with password (reuses the same PBKDF2 + AES-GCM wrapper)
      const keyBundleJson = JSON.stringify({
        v: 1,
        rsaPrivateKeyPEM: privateKeyPEM,
        mlkemSecretKeyB64: mlkemSecretKey,
      });
      const encryptedKeyBundle = await encryptPrivateKeyWithPassword(keyBundleJson, password);

      localStorage.setItem('encryptedKeyBundleV1', encryptedKeyBundle);
      await secureStoreSet('encryptedKeyBundleV1', encryptedKeyBundle);
      // Keep legacy key for older code paths
      localStorage.setItem('encryptedPrivateKey', await encryptPrivateKeyWithPassword(privateKeyPEM, password));

      // Upload public keys + capabilities to server
      const publishPayload = {
        publicKey: publicKeyPEM,
        mlkemPublicKey,
        keyCapabilities: ['rsa-oaep-2048', 'mlkem-768'],
      };
      await userAPI.updatePublicKey(publishPayload);
      // Best-effort publish into KMS directory (does not break if KMS is down)
      try {
        await kmsAPI.publishKeys(publishPayload);
      } catch (e) {
        console.warn('KMS publish failed (continuing):', e);
      }

      // Store private key in memory (decrypted)
      setPrivateKey(keyPair.privateKey);
      setMlkemSecretKeyB64(mlkemSecretKey);

      return { success: true };
    } catch (error) {
      console.error('Error initializing keys:', error);
      return { success: false, message: 'Failed to initialize encryption keys' };
    }
  };

  const loadOrGenerateKeys = async (password) => {
    try {
      const storedEncryptedPrivateKey = localStorage.getItem('encryptedPrivateKey');
      const storedEncryptedKeyBundle = localStorage.getItem('encryptedKeyBundleV1');

      const keyBundleCipher =
        storedEncryptedKeyBundle || (await secureStoreGet('encryptedKeyBundleV1'));

      if (keyBundleCipher) {
        if (!storedEncryptedKeyBundle) {
          localStorage.setItem('encryptedKeyBundleV1', keyBundleCipher);
        }
        const bundleJson = await decryptPrivateKeyWithPassword(keyBundleCipher, password);
        const bundle = JSON.parse(bundleJson);
        if (!bundle?.rsaPrivateKeyPEM) throw new Error('Invalid key bundle');

        const rsaPrivateKey = await importPrivateKey(bundle.rsaPrivateKeyPEM);
        setPrivateKey(rsaPrivateKey);
        setMlkemSecretKeyB64(bundle.mlkemSecretKeyB64 || null);
      } else if (storedEncryptedPrivateKey) {
        // Legacy: Decrypt and load existing RSA private key only
        const privateKeyPEM = await decryptPrivateKeyWithPassword(storedEncryptedPrivateKey, password);
        const rsaPrivateKey = await importPrivateKey(privateKeyPEM);
        setPrivateKey(rsaPrivateKey);
        setMlkemSecretKeyB64(null);
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
    localStorage.removeItem('encryptedKeyBundleV1');
    setUser(null);
    setPrivateKey(null);
    setMlkemSecretKeyB64(null);
  };

  const value = {
    user,
    privateKey,
    mlkemSecretKeyB64,
    loading,
    register,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

