/**
 * Phishing Detection ML Model
 * Uses Naive Bayes classifier to detect phishing emails
 */

// Simplified Naive Bayes implementation for phishing detection
class PhishingDetector {
  constructor() {
    this.model = {
      features: {
        // URL features
        suspiciousUrl: { phishing: 0, legit: 0 },
        shortUrl: { phishing: 0, legit: 0 },
        ipAddress: { phishing: 0, legit: 0 },
        // Sender features
        unknownSender: { phishing: 0, legit: 0 },
        suspiciousDomain: { phishing: 0, legit: 0 },
        // Content features
        urgencyKeywords: { phishing: 0, legit: 0 },
        requestPersonalInfo: { phishing: 0, legit: 0 },
        suspiciousAttachments: { phishing: 0, legit: 0 },
        // Payload features
        suspiciousKeywords: { phishing: 0, legit: 0 },
        grammarErrors: { phishing: 0, legit: 0 },
      },
      totals: { phishing: 0, legit: 0 },
    };
    this.isTrained = false;
  }

  /**
   * Train the model with sample data
   */
  train(trainingData) {
    // Reset model
    this.model = {
      features: {
        suspiciousUrl: { phishing: 0, legit: 0 },
        shortUrl: { phishing: 0, legit: 0 },
        ipAddress: { phishing: 0, legit: 0 },
        unknownSender: { phishing: 0, legit: 0 },
        suspiciousDomain: { phishing: 0, legit: 0 },
        urgencyKeywords: { phishing: 0, legit: 0 },
        requestPersonalInfo: { phishing: 0, legit: 0 },
        suspiciousAttachments: { phishing: 0, legit: 0 },
        suspiciousKeywords: { phishing: 0, legit: 0 },
        grammarErrors: { phishing: 0, legit: 0 },
      },
      totals: { phishing: 0, legit: 0 },
    };

    // Train on provided data
    trainingData.forEach((sample) => {
      const label = sample.label; // 'phishing' or 'legit'
      this.model.totals[label]++;

      // Update feature counts
      Object.keys(sample.features).forEach((feature) => {
        if (this.model.features[feature]) {
          this.model.features[feature][label] += sample.features[feature] ? 1 : 0;
        }
      });
    });

    // Apply Laplace smoothing (add 1 to avoid zero probabilities)
    Object.keys(this.model.features).forEach((feature) => {
      this.model.features[feature].phishing += 1;
      this.model.features[feature].legit += 1;
      this.model.totals.phishing += 1;
      this.model.totals.legit += 1;
    });

    this.isTrained = true;
  }

  /**
   * Extract features from email metadata
   */
  extractFeatures(email) {
    const features = {
      suspiciousUrl: this.hasSuspiciousUrl(email),
      shortUrl: this.hasShortUrl(email),
      ipAddress: this.hasIpAddress(email),
      unknownSender: this.isUnknownSender(email),
      suspiciousDomain: this.hasSuspiciousDomain(email),
      urgencyKeywords: this.hasUrgencyKeywords(email),
      requestPersonalInfo: this.requestsPersonalInfo(email),
      suspiciousAttachments: this.hasSuspiciousAttachments(email),
      suspiciousKeywords: this.hasSuspiciousKeywords(email),
      grammarErrors: this.hasGrammarErrors(email),
    };
    return features;
  }

  /**
   * Predict if email is phishing
   */
  predict(email) {
    if (!this.isTrained) {
      // Use default training data
      this.trainDefault();
    }

    const features = this.extractFeatures(email);
    let phishingScore = Math.log(this.model.totals.phishing / (this.model.totals.phishing + this.model.totals.legit));
    let legitScore = Math.log(this.model.totals.legit / (this.model.totals.phishing + this.model.totals.legit));

    Object.keys(features).forEach((feature) => {
      if (features[feature]) {
        const phishingProb = this.model.features[feature].phishing / this.model.totals.phishing;
        const legitProb = this.model.features[feature].legit / this.model.totals.legit;
        phishingScore += Math.log(phishingProb);
        legitScore += Math.log(legitProb);
      } else {
        const phishingProb = (this.model.totals.phishing - this.model.features[feature].phishing) / this.model.totals.phishing;
        const legitProb = (this.model.totals.legit - this.model.features[feature].legit) / this.model.totals.legit;
        phishingScore += Math.log(phishingProb);
        legitScore += Math.log(legitProb);
      }
    });

    const phishingProbability = Math.exp(phishingScore) / (Math.exp(phishingScore) + Math.exp(legitScore));
    const riskScore = Math.round(phishingProbability * 100);

    return {
      isPhishing: phishingProbability > 0.5,
      riskScore: riskScore,
      riskLevel: this.getRiskLevel(riskScore),
      confidence: Math.abs(phishingProbability - 0.5) * 2, // 0-1, higher = more confident
    };
  }

  /**
   * Get risk level from score
   */
  getRiskLevel(score) {
    if (score >= 70) return 'High';
    if (score >= 40) return 'Medium';
    return 'Low';
  }

  /**
   * Train with default phishing patterns
   */
  trainDefault() {
    const defaultTraining = [
      // Phishing examples
      { label: 'phishing', features: { suspiciousUrl: true, urgencyKeywords: true, requestPersonalInfo: true } },
      { label: 'phishing', features: { shortUrl: true, unknownSender: true, suspiciousKeywords: true } },
      { label: 'phishing', features: { suspiciousDomain: true, urgencyKeywords: true, grammarErrors: true } },
      { label: 'phishing', features: { ipAddress: true, suspiciousAttachments: true, requestPersonalInfo: true } },
      // Legit examples
      { label: 'legit', features: { suspiciousUrl: false, urgencyKeywords: false, requestPersonalInfo: false } },
      { label: 'legit', features: { shortUrl: false, unknownSender: false, suspiciousKeywords: false } },
      { label: 'legit', features: { suspiciousDomain: false, urgencyKeywords: false, grammarErrors: false } },
    ];
    this.train(defaultTraining);
  }

  // Feature extraction helpers
  hasSuspiciousUrl(email) {
    // Check for suspicious URL patterns (simplified)
    const urlPatterns = /(https?:\/\/[^\s]+)/gi;
    const urls = email.body?.match(urlPatterns) || [];
    return urls.some((url) => {
      return (
        url.includes('bit.ly') ||
        url.includes('tinyurl') ||
        url.includes('t.co') ||
        url.includes('goo.gl') ||
        url.includes('redirect')
      );
    });
  }

  hasShortUrl(email) {
    const urlPatterns = /(https?:\/\/[^\s]+)/gi;
    const urls = email.body?.match(urlPatterns) || [];
    return urls.some((url) => url.length < 30);
  }

  hasIpAddress(email) {
    const ipPattern = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;
    return ipPattern.test(email.body || '');
  }

  isUnknownSender(email) {
    // Check if sender is in contacts (simplified - would check actual contacts)
    return !email.sender?.email || email.sender.email.includes('noreply') || email.sender.email.includes('no-reply');
  }

  hasSuspiciousDomain(email) {
    const senderDomain = email.sender?.email?.split('@')[1] || '';
    const suspiciousDomains = ['gmail.com', 'yahoo.com', 'hotmail.com']; // Simplified
    return !suspiciousDomains.includes(senderDomain.toLowerCase());
  }

  hasUrgencyKeywords(email) {
    const urgencyWords = ['urgent', 'immediate', 'asap', 'expire', 'suspended', 'verify', 'confirm', 'action required'];
    const text = (email.subject || '') + ' ' + (email.body || '');
    return urgencyWords.some((word) => text.toLowerCase().includes(word));
  }

  requestsPersonalInfo(email) {
    const personalInfoWords = ['password', 'ssn', 'credit card', 'account number', 'social security'];
    const text = (email.subject || '') + ' ' + (email.body || '');
    return personalInfoWords.some((word) => text.toLowerCase().includes(word));
  }

  hasSuspiciousAttachments(email) {
    // Check for suspicious file extensions
    const suspiciousExtensions = ['.exe', '.bat', '.scr', '.vbs', '.js'];
    return email.attachments?.some((att) =>
      suspiciousExtensions.some((ext) => att.name?.toLowerCase().endsWith(ext))
    );
  }

  hasSuspiciousKeywords(email) {
    const suspiciousWords = ['click here', 'verify account', 'update payment', 'suspended account'];
    const text = (email.subject || '') + ' ' + (email.body || '');
    return suspiciousWords.some((word) => text.toLowerCase().includes(word));
  }

  hasGrammarErrors(email) {
    // Simplified grammar check
    const text = (email.subject || '') + ' ' + (email.body || '');
    const commonErrors = ['your account', 'youre', 'its important'];
    return commonErrors.some((error) => text.toLowerCase().includes(error));
  }

  /**
   * Retrain model with user feedback
   */
  retrainWithFeedback(email, userLabel) {
    const features = this.extractFeatures(email);
    const trainingSample = {
      label: userLabel, // 'phishing' or 'legit'
      features: features,
    };
    this.train([trainingSample, ...this.getRecentTrainingData()]);
  }

  getRecentTrainingData() {
    // Get recent training data from localStorage or localDB
    const stored = localStorage.getItem('phishingTrainingData');
    return stored ? JSON.parse(stored) : [];
  }
}

// Export singleton instance
export const phishingDetector = new PhishingDetector();

// Initialize with default training
phishingDetector.trainDefault();

