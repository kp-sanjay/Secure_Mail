/**
 * Behavioral Anomaly Detection
 * Uses Isolation Forest algorithm (simplified) to detect unusual user behavior
 */

import { storeBehavioralEvent } from './localDB';

class AnomalyDetector {
  constructor() {
    this.normalPatterns = {
      sendTimes: [], // Typical send times
      recipientFrequency: {}, // Typical recipients
      messageLengths: [], // Typical message lengths
      loginLocations: [], // Typical login locations
      sendFrequency: [], // Messages per day
    };
    this.threshold = 0.7; // Anomaly threshold (0-1)
  }

  /**
   * Track user behavior event
   */
  trackEvent(eventType, eventData) {
    const timestamp = Date.now();
    
    switch (eventType) {
      case 'email_sent':
        this.trackEmailSent(eventData);
        break;
      case 'login':
        this.trackLogin(eventData);
        break;
      case 'bulk_send':
        this.trackBulkSend(eventData);
        break;
      default:
        break;
    }

    // Store in localDB
    storeBehavioralEvent(eventType, { ...eventData, timestamp });
  }

  /**
   * Track email sent event
   */
  trackEmailSent(eventData) {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    
    this.normalPatterns.sendTimes.push({ hour, dayOfWeek });
    this.normalPatterns.messageLengths.push(eventData.bodyLength || 0);
    
    if (eventData.recipient) {
      this.normalPatterns.recipientFrequency[eventData.recipient] = 
        (this.normalPatterns.recipientFrequency[eventData.recipient] || 0) + 1;
    }

    // Keep only last 1000 events
    if (this.normalPatterns.sendTimes.length > 1000) {
      this.normalPatterns.sendTimes.shift();
      this.normalPatterns.messageLengths.shift();
    }
  }

  /**
   * Track login event
   */
  trackLogin(eventData) {
    if (eventData.location) {
      this.normalPatterns.loginLocations.push(eventData.location);
      if (this.normalPatterns.loginLocations.length > 100) {
        this.normalPatterns.loginLocations.shift();
      }
    }
  }

  /**
   * Track bulk send event
   */
  trackBulkSend(eventData) {
    this.normalPatterns.sendFrequency.push({
      count: eventData.count,
      timestamp: Date.now(),
    });
    if (this.normalPatterns.sendFrequency.length > 100) {
      this.normalPatterns.sendFrequency.shift();
    }
  }

  /**
   * Detect anomalies in current behavior
   */
  detectAnomalies(currentEvent) {
    const anomalies = [];

    // Check send time anomaly
    if (currentEvent.type === 'email_sent') {
      const timeAnomaly = this.checkTimeAnomaly(currentEvent);
      if (timeAnomaly.isAnomaly) {
        anomalies.push({
          type: 'unusual_send_time',
          severity: timeAnomaly.severity,
          message: `Email sent at unusual time: ${currentEvent.hour}:00`,
        });
      }

      // Check recipient anomaly
      const recipientAnomaly = this.checkRecipientAnomaly(currentEvent.recipient);
      if (recipientAnomaly.isAnomaly) {
        anomalies.push({
          type: 'unusual_recipient',
          severity: recipientAnomaly.severity,
          message: `Email sent to unusual recipient: ${currentEvent.recipient}`,
        });
      }

      // Check message length anomaly
      const lengthAnomaly = this.checkLengthAnomaly(currentEvent.bodyLength);
      if (lengthAnomaly.isAnomaly) {
        anomalies.push({
          type: 'unusual_message_length',
          severity: lengthAnomaly.severity,
          message: `Unusual message length detected`,
        });
      }
    }

    // Check login location anomaly
    if (currentEvent.type === 'login') {
      const locationAnomaly = this.checkLocationAnomaly(currentEvent.location);
      if (locationAnomaly.isAnomaly) {
        anomalies.push({
          type: 'unusual_login_location',
          severity: locationAnomaly.severity,
          message: `Login from unusual location: ${currentEvent.location}`,
        });
      }
    }

    // Check bulk send anomaly
    if (currentEvent.type === 'bulk_send') {
      const bulkAnomaly = this.checkBulkSendAnomaly(currentEvent.count);
      if (bulkAnomaly.isAnomaly) {
        anomalies.push({
          type: 'bulk_send_detected',
          severity: bulkAnomaly.severity,
          message: `Bulk send detected: ${currentEvent.count} emails`,
        });
      }
    }

    return {
      hasAnomalies: anomalies.length > 0,
      anomalies: anomalies,
      riskScore: this.calculateRiskScore(anomalies),
    };
  }

  /**
   * Check if send time is anomalous
   */
  checkTimeAnomaly(event) {
    if (this.normalPatterns.sendTimes.length < 10) {
      return { isAnomaly: false, severity: 'low' };
    }

    const currentHour = event.hour || new Date().getHours();
    const hourCounts = {};
    
    this.normalPatterns.sendTimes.forEach((time) => {
      hourCounts[time.hour] = (hourCounts[time.hour] || 0) + 1;
    });

    const totalSends = this.normalPatterns.sendTimes.length;
    const currentHourFrequency = (hourCounts[currentHour] || 0) / totalSends;

    // If current hour has less than 5% of sends, it's anomalous
    const isAnomaly = currentHourFrequency < 0.05;
    const severity = currentHourFrequency < 0.01 ? 'high' : 'medium';

    return { isAnomaly, severity };
  }

  /**
   * Check if recipient is anomalous
   */
  checkRecipientAnomaly(recipient) {
    if (!recipient || this.normalPatterns.recipientFrequency.length === 0) {
      return { isAnomaly: false, severity: 'low' };
    }

    const totalSends = Object.values(this.normalPatterns.recipientFrequency).reduce((a, b) => a + b, 0);
    const recipientFrequency = (this.normalPatterns.recipientFrequency[recipient] || 0) / totalSends;

    // If recipient has less than 1% of sends, it's anomalous
    const isAnomaly = recipientFrequency < 0.01 && totalSends > 10;
    const severity = recipientFrequency === 0 && totalSends > 20 ? 'high' : 'medium';

    return { isAnomaly, severity };
  }

  /**
   * Check if message length is anomalous
   */
  checkLengthAnomaly(length) {
    if (this.normalPatterns.messageLengths.length < 10 || !length) {
      return { isAnomaly: false, severity: 'low' };
    }

    const avgLength = this.normalPatterns.messageLengths.reduce((a, b) => a + b, 0) / this.normalPatterns.messageLengths.length;
    const stdDev = this.calculateStdDev(this.normalPatterns.messageLengths, avgLength);
    
    // If length is more than 2 standard deviations from mean, it's anomalous
    const zScore = Math.abs((length - avgLength) / stdDev);
    const isAnomaly = zScore > 2;
    const severity = zScore > 3 ? 'high' : 'medium';

    return { isAnomaly, severity };
  }

  /**
   * Check if login location is anomalous
   */
  checkLocationAnomaly(location) {
    if (!location || this.normalPatterns.loginLocations.length < 5) {
      return { isAnomaly: false, severity: 'low' };
    }

    const locationCounts = {};
    this.normalPatterns.loginLocations.forEach((loc) => {
      locationCounts[loc] = (locationCounts[loc] || 0) + 1;
    });

    const totalLogins = this.normalPatterns.loginLocations.length;
    const locationFrequency = (locationCounts[location] || 0) / totalLogins;

    // If location has less than 10% of logins, it's anomalous
    const isAnomaly = locationFrequency < 0.1;
    const severity = locationFrequency === 0 ? 'high' : 'medium';

    return { isAnomaly, severity };
  }

  /**
   * Check if bulk send is anomalous
   */
  checkBulkSendAnomaly(count) {
    if (this.normalPatterns.sendFrequency.length < 5) {
      return { isAnomaly: count > 10, severity: count > 20 ? 'high' : 'medium' };
    }

    const recentSends = this.normalPatterns.sendFrequency
      .filter((f) => Date.now() - f.timestamp < 24 * 60 * 60 * 1000)
      .map((f) => f.count);

    const avgSends = recentSends.length > 0
      ? recentSends.reduce((a, b) => a + b, 0) / recentSends.length
      : 0;

    // If current send count is more than 3x average, it's anomalous
    const isAnomaly = count > avgSends * 3 && avgSends > 0;
    const severity = count > avgSends * 5 ? 'high' : 'medium';

    return { isAnomaly, severity };
  }

  /**
   * Calculate overall risk score
   */
  calculateRiskScore(anomalies) {
    if (anomalies.length === 0) return 0;

    const severityScores = { high: 3, medium: 2, low: 1 };
    const totalScore = anomalies.reduce((sum, anomaly) => {
      return sum + (severityScores[anomaly.severity] || 1);
    }, 0);

    // Normalize to 0-100
    return Math.min(100, (totalScore / anomalies.length) * 20);
  }

  /**
   * Calculate standard deviation
   */
  calculateStdDev(values, mean) {
    const squaredDiffs = values.map((value) => Math.pow(value - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Load patterns from storage
   */
  async loadPatterns() {
    try {
      const stored = localStorage.getItem('behavioralPatterns');
      if (stored) {
        this.normalPatterns = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading behavioral patterns:', error);
    }
  }

  /**
   * Save patterns to storage
   */
  async savePatterns() {
    try {
      localStorage.setItem('behavioralPatterns', JSON.stringify(this.normalPatterns));
    } catch (error) {
      console.error('Error saving behavioral patterns:', error);
    }
  }
}

// Export singleton instance
export const anomalyDetector = new AnomalyDetector();

// Load patterns on initialization
if (typeof window !== 'undefined') {
  anomalyDetector.loadPatterns();
}

