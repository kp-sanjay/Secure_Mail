/**
 * Local encrypted database using localStorage (fallback)
 * Stores encrypted keys and user data locally
 * Note: sql.js requires special Vite configuration, so we use localStorage as a simpler alternative
 */

let dbInitialized = false;

/**
 * Initialize the local database (localStorage-based)
 */
export async function initLocalDB() {
  if (dbInitialized) return true;
  
  try {
    // Initialize localStorage structure if needed
    if (!localStorage.getItem('secureMailDB_initialized')) {
      // Initialize storage structure
      localStorage.setItem('secureMailDB_keys', JSON.stringify({}));
      localStorage.setItem('secureMailDB_preferences', JSON.stringify({}));
      localStorage.setItem('secureMailDB_email_cache', JSON.stringify({}));
      localStorage.setItem('secureMailDB_search_indexes', JSON.stringify([]));
      localStorage.setItem('secureMailDB_behavioral_data', JSON.stringify([]));
      localStorage.setItem('secureMailDB_initialized', 'true');
    }
    dbInitialized = true;
    return true;
  } catch (error) {
    console.error('Error initializing local database:', error);
    return false;
  }
}

// Helper functions for localStorage operations
function getStorageItem(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error reading ${key}:`, error);
    return defaultValue;
  }
}

function setStorageItem(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error writing ${key}:`, error);
  }
}

/**
 * Store encrypted key
 */
export async function storeEncryptedKey(keyType, keyName, encryptedKey) {
  await initLocalDB();
  
  try {
    const keys = getStorageItem('secureMailDB_keys', {});
    const keyId = `${keyType}_${keyName}`;
    keys[keyId] = {
      key_type: keyType,
      key_name: keyName,
      encrypted_key: encryptedKey,
      created_at: Date.now(),
    };
    setStorageItem('secureMailDB_keys', keys);
  } catch (error) {
    console.error('Error storing key:', error);
    throw error;
  }
}

/**
 * Retrieve encrypted key
 */
export async function getEncryptedKey(keyType, keyName) {
  await initLocalDB();
  
  try {
    const keys = getStorageItem('secureMailDB_keys', {});
    const keyId = `${keyType}_${keyName}`;
    return keys[keyId]?.encrypted_key || null;
  } catch (error) {
    console.error('Error retrieving key:', error);
    return null;
  }
}

/**
 * Store user preference
 */
export async function setPreference(key, value) {
  await initLocalDB();
  
  try {
    const preferences = getStorageItem('secureMailDB_preferences', {});
    preferences[key] = value;
    setStorageItem('secureMailDB_preferences', preferences);
  } catch (error) {
    console.error('Error setting preference:', error);
    throw error;
  }
}

/**
 * Get user preference
 */
export async function getPreference(key) {
  await initLocalDB();
  
  try {
    const preferences = getStorageItem('secureMailDB_preferences', {});
    return preferences[key] || null;
  } catch (error) {
    console.error('Error getting preference:', error);
    return null;
  }
}

/**
 * Store email in cache
 */
export async function cacheEmail(emailId, emailData) {
  await initLocalDB();
  
  try {
    const cache = getStorageItem('secureMailDB_email_cache', {});
    cache[emailId] = {
      email_data: emailData,
      cached_at: Date.now(),
    };
    setStorageItem('secureMailDB_email_cache', cache);
  } catch (error) {
    console.error('Error caching email:', error);
  }
}

/**
 * Get cached email
 */
export async function getCachedEmail(emailId) {
  await initLocalDB();
  
  try {
    const cache = getStorageItem('secureMailDB_email_cache', {});
    return cache[emailId]?.email_data || null;
  } catch (error) {
    console.error('Error getting cached email:', error);
    return null;
  }
}

/**
 * Store search index
 */
export async function storeSearchIndex(emailId, encryptedIndex) {
  await initLocalDB();
  
  try {
    const indexes = getStorageItem('secureMailDB_search_indexes', []);
    indexes.push({
      email_id: emailId,
      encrypted_index: encryptedIndex,
      created_at: Date.now(),
    });
    setStorageItem('secureMailDB_search_indexes', indexes);
  } catch (error) {
    console.error('Error storing search index:', error);
  }
}

/**
 * Search encrypted indexes
 */
export async function searchIndexes(query) {
  await initLocalDB();
  
  try {
    // Note: This is a simplified search. In production, you'd use
    // encrypted search techniques like searchable encryption or bloom filters
    const indexes = getStorageItem('secureMailDB_search_indexes', []);
    const results = indexes
      .filter((idx) => idx.encrypted_index && idx.encrypted_index.includes(query))
      .map((idx) => idx.email_id);
    
    return results;
  } catch (error) {
    console.error('Error searching indexes:', error);
    return [];
  }
}

/**
 * Store behavioral event
 */
export async function storeBehavioralEvent(eventType, eventData) {
  await initLocalDB();
  
  try {
    const events = getStorageItem('secureMailDB_behavioral_data', []);
    events.push({
      event_type: eventType,
      event_data: eventData,
      timestamp: Date.now(),
    });
    
    // Keep only last 1000 events to prevent storage bloat
    if (events.length > 1000) {
      events.splice(0, events.length - 1000);
    }
    
    setStorageItem('secureMailDB_behavioral_data', events);
  } catch (error) {
    console.error('Error storing behavioral event:', error);
  }
}

/**
 * Get behavioral events
 */
export async function getBehavioralEvents(eventType, limit = 100) {
  await initLocalDB();
  
  try {
    const allEvents = getStorageItem('secureMailDB_behavioral_data', []);
    const filtered = allEvents
      .filter((event) => event.event_type === eventType)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
      .map((event) => ({
        data: event.event_data,
        timestamp: event.timestamp,
      }));
    
    return filtered;
  } catch (error) {
    console.error('Error getting behavioral events:', error);
    return [];
  }
}

