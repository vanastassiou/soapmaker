/**
 * Unit tests for sync.js
 */

import { jest } from '@jest/globals';

// Mock the core module before importing sync
jest.unstable_mockModule('../core/js/index.js', () => {
  return {
    createSyncEngine: jest.fn((config) => ({
      sync: jest.fn().mockResolvedValue({ status: 'synced' }),
      canSync: jest.fn().mockReturnValue(true),
      getStatus: jest.fn().mockReturnValue('idle'),
      onStatusChange: jest.fn().mockReturnValue(() => {}),
      getLastSync: jest.fn().mockReturnValue(null)
    })),
    createGoogleDriveProvider: jest.fn((config) => ({
      connect: jest.fn().mockResolvedValue(true),
      disconnect: jest.fn(),
      isConnected: jest.fn().mockReturnValue(false),
      isFolderConfigured: jest.fn().mockReturnValue(false),
      selectFolder: jest.fn().mockResolvedValue({ id: 'folder-123', name: 'seneschal-sync' }),
      getFolder: jest.fn().mockReturnValue(null),
      handleAuthCallback: jest.fn().mockResolvedValue(true)
    })),
    hasOAuthCallback: () => false
  };
});

// Mock state module
jest.unstable_mockModule('../js/state/state.js', () => ({
  exportAllData: jest.fn().mockReturnValue({
    version: 2,
    exportedAt: new Date().toISOString(),
    recipe: [],
    recipeLocks: [],
    excludedFats: [],
    recipeAdditives: [],
    cupboardFats: [],
    cupboardLocks: [],
    cupboardSuggestions: [],
    allowRatioMode: false
  }),
  importUserData: jest.fn()
}));

// Import after mocking
const sync = await import('../js/lib/sync.js');

// =============================================================================
// Module exports tests
// =============================================================================

describe('sync module exports', () => {
  test('should export initSync function', () => {
    expect(typeof sync.initSync).toBe('function');
  });

  test('should export checkOAuthCallback function', () => {
    expect(typeof sync.checkOAuthCallback).toBe('function');
  });

  test('should export handleOAuthCallback function', () => {
    expect(typeof sync.handleOAuthCallback).toBe('function');
  });

  test('should export connect function', () => {
    expect(typeof sync.connect).toBe('function');
  });

  test('should export disconnect function', () => {
    expect(typeof sync.disconnect).toBe('function');
  });

  test('should export isConnected function', () => {
    expect(typeof sync.isConnected).toBe('function');
  });

  test('should export isFolderConfigured function', () => {
    expect(typeof sync.isFolderConfigured).toBe('function');
  });

  test('should export selectFolder function', () => {
    expect(typeof sync.selectFolder).toBe('function');
  });

  test('should export getFolder function', () => {
    expect(typeof sync.getFolder).toBe('function');
  });

  test('should export sync function', () => {
    expect(typeof sync.sync).toBe('function');
  });

  test('should export canSync function', () => {
    expect(typeof sync.canSync).toBe('function');
  });

  test('should export getStatus function', () => {
    expect(typeof sync.getStatus).toBe('function');
  });

  test('should export onStatusChange function', () => {
    expect(typeof sync.onStatusChange).toBe('function');
  });

  test('should export getLastSync function', () => {
    expect(typeof sync.getLastSync).toBe('function');
  });

  test('should export default object with all functions', () => {
    expect(typeof sync.default).toBe('object');
    expect(typeof sync.default.initSync).toBe('function');
    expect(typeof sync.default.connect).toBe('function');
    expect(typeof sync.default.sync).toBe('function');
  });
});

// =============================================================================
// Pre-initialization behavior tests
// =============================================================================

describe('sync pre-initialization', () => {
  test('should return false for isConnected before init', () => {
    expect(sync.isConnected()).toBe(false);
  });

  test('should return false for isFolderConfigured before init', () => {
    expect(sync.isFolderConfigured()).toBe(false);
  });

  test('should return null for getFolder before init', () => {
    expect(sync.getFolder()).toBeNull();
  });

  test('should return false for canSync before init', () => {
    expect(sync.canSync()).toBe(false);
  });

  test('should return idle for getStatus before init', () => {
    expect(sync.getStatus()).toBe('idle');
  });

  test('should return null for getLastSync before init', () => {
    expect(sync.getLastSync()).toBeNull();
  });

  test('should return noop function for onStatusChange before init', () => {
    const unsubscribe = sync.onStatusChange(() => {});
    expect(typeof unsubscribe).toBe('function');
  });
});

// =============================================================================
// Initialization tests
// =============================================================================

describe('sync initialization', () => {
  const mockConfig = {
    google: {
      clientId: 'test-client-id',
      apiKey: 'test-api-key'
    },
    redirectUri: 'http://localhost'
  };

  test('should return provider and syncEngine from initSync', () => {
    const result = sync.initSync(mockConfig);

    expect(result).toHaveProperty('provider');
    expect(result).toHaveProperty('syncEngine');
    expect(result.provider).not.toBeNull();
    expect(result.syncEngine).not.toBeNull();
  });

  test('should allow isConnected after init', () => {
    sync.initSync(mockConfig);
    const connected = sync.isConnected();
    expect(typeof connected).toBe('boolean');
  });

  test('should allow getStatus after init', () => {
    sync.initSync(mockConfig);
    const status = sync.getStatus();
    expect(typeof status).toBe('string');
  });

  test('should check OAuth callback status', () => {
    const result = sync.checkOAuthCallback();
    expect(typeof result).toBe('boolean');
  });
});

// =============================================================================
// Operations after init
// =============================================================================

describe('sync operations after init', () => {
  const mockConfig = {
    google: {
      clientId: 'test-client-id',
      apiKey: 'test-api-key'
    },
    redirectUri: 'http://localhost'
  };

  beforeEach(() => {
    sync.initSync(mockConfig);
  });

  test('should return boolean for isConnected', () => {
    const result = sync.isConnected();
    expect(typeof result).toBe('boolean');
  });

  test('should return boolean for isFolderConfigured', () => {
    const result = sync.isFolderConfigured();
    expect(typeof result).toBe('boolean');
  });

  test('should return value or null for getFolder', () => {
    const result = sync.getFolder();
    expect(result === null || typeof result === 'object').toBe(true);
  });

  test('should return boolean for canSync', () => {
    const result = sync.canSync();
    expect(typeof result).toBe('boolean');
  });

  test('should return string for getStatus', () => {
    const result = sync.getStatus();
    expect(typeof result).toBe('string');
  });

  test('should return unsubscribe function for onStatusChange', () => {
    const unsubscribe = sync.onStatusChange(() => {});
    expect(typeof unsubscribe).toBe('function');
  });

  test('disconnect should not throw', () => {
    expect(() => sync.disconnect()).not.toThrow();
  });
});
