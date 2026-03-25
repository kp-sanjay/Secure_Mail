import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, kmsAPI, userAPI } from '../utils/api';
import {
  generateRSAKeyPair,
  exportPublicKey,
  exportPrivateKey,
  importPrivateKey,
  encryptPrivateKeyWithPassword,
  decryptPrivateKeyWithPassword,
  exportPublicKeyFromPrivateRSA,
} from '../utils/crypto';
import { mlkemGenerateKeyPairBase64, inferMlKemVariantFromSecretKeyB64 } from '../utils/pqc';

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
  /** Legacy ML-KEM-768 secret (after upgrade); used only to open older envelopes */
  const [mlkem768SecretKeyB64, setMlkem768SecretKeyB64] = useState(null);

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

  const register = async (name, email, password, extra = {}) => {
    try {
      const response = await authAPI.register({
        name,
        email,
        password,
        department: extra.department,
        jobRole: extra.jobRole,
      });
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

      // ML-KEM-1024 (CRYSTALS-Kyber) for Level 2 & 4 key establishment
      const { publicKeyB64: mlkemPublicKey, secretKeyB64: mlkemSecretKey } =
        await mlkemGenerateKeyPairBase64();

      // Encrypt a key bundle with password (reuses the same PBKDF2 + AES-GCM wrapper)
      const keyBundleJson = JSON.stringify({
        v: 2,
        rsaPrivateKeyPEM: privateKeyPEM,
        mlkemSecretKeyB64: mlkemSecretKey,
        mlkem768SecretKeyB64: null,
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
        keyCapabilities: ['rsa-oaep-2048', 'mlkem-1024', 'crystals-kyber-1024'],
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
      setMlkem768SecretKeyB64(null);

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
        let bundleJson = await decryptPrivateKeyWithPassword(keyBundleCipher, password);
        let bundle = JSON.parse(bundleJson);
        if (!bundle?.rsaPrivateKeyPEM) throw new Error('Invalid key bundle');

        let rsaPrivateKey = await importPrivateKey(bundle.rsaPrivateKeyPEM);
        let mlkMain = bundle.mlkemSecretKeyB64 || null;
        let mlkLegacy = bundle.mlkem768SecretKeyB64 || null;

        const variant = inferMlKemVariantFromSecretKeyB64(mlkMain);
        if (variant === 'ML-KEM-768' && !mlkLegacy) {
          const { publicKeyB64, secretKeyB64 } = await mlkemGenerateKeyPairBase64();
          mlkLegacy = mlkMain;
          mlkMain = secretKeyB64;
          bundle = {
            v: 2,
            rsaPrivateKeyPEM: bundle.rsaPrivateKeyPEM,
            mlkemSecretKeyB64: mlkMain,
            mlkem768SecretKeyB64: mlkLegacy,
          };
          const encBundle = await encryptPrivateKeyWithPassword(JSON.stringify(bundle), password);
          localStorage.setItem('encryptedKeyBundleV1', encBundle);
          await secureStoreSet('encryptedKeyBundleV1', encBundle);
          const rsaPub = await exportPublicKeyFromPrivateRSA(rsaPrivateKey);
          const rsaPem = await exportPublicKey(rsaPub);
          await userAPI.updatePublicKey({
            publicKey: rsaPem,
            mlkemPublicKey: publicKeyB64,
            keyCapabilities: ['rsa-oaep-2048', 'mlkem-1024', 'crystals-kyber-1024'],
          });
          try {
            await kmsAPI.publishKeys({
              publicKey: rsaPem,
              mlkemPublicKey: publicKeyB64,
              keyCapabilities: ['rsa-oaep-2048', 'mlkem-1024', 'crystals-kyber-1024'],
            });
          } catch (e) {
            console.warn('KMS publish after ML-KEM upgrade failed:', e);
          }
        }

        setPrivateKey(rsaPrivateKey);
        setMlkemSecretKeyB64(mlkMain);
        setMlkem768SecretKeyB64(mlkLegacy);
      } else if (storedEncryptedPrivateKey) {
        // Legacy: Decrypt and load existing RSA private key only
        const privateKeyPEM = await decryptPrivateKeyWithPassword(storedEncryptedPrivateKey, password);
        const rsaPrivateKey = await importPrivateKey(privateKeyPEM);
        setPrivateKey(rsaPrivateKey);
        setMlkemSecretKeyB64(null);
        setMlkem768SecretKeyB64(null);
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
    setMlkem768SecretKeyB64(null);
  };

  const value = {
    user,
    privateKey,
    mlkemSecretKeyB64,
    mlkem768SecretKeyB64,
    loading,
    register,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

