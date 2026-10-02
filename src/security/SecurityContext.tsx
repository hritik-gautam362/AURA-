/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { LockState } from './securityTypes';
import { keyManager } from './keyManager';

export interface SecurityContextValue {
  lockState: LockState;
  isUnlocked: boolean;
  isInitialized: boolean;
  failedAttempts: number;
  setupVault: (pin: string) => Promise<void>;
  unlock: (pin: string) => Promise<void>;
  lock: () => void;
  withUnlockedKey: <T>(callback: (key: CryptoKey) => Promise<T> | T) => Promise<T>;
}

const SecurityContext = createContext<SecurityContextValue | null>(null);

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lockState, setLockState] = useState<LockState>(keyManager.getLockState());
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [failedAttempts, setFailedAttempts] = useState<number>(0);

  useEffect(() => {
    // Initial check of vault status
    keyManager.checkInitialized().then((initialized) => {
      setIsInitialized(initialized);
      setLockState(keyManager.getLockState());
    });

    // Subscribe to keyManager lock state transitions
    const unsubscribe = keyManager.onLockStateChange((newState) => {
      setLockState(newState);
      setFailedAttempts(keyManager.getFailedAttempts());
      if (newState === 'unlocked') {
        setIsInitialized(true);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const setupVault = async (pin: string): Promise<void> => {
    await keyManager.initializeVault(pin);
  };

  const unlock = async (pin: string): Promise<void> => {
    await keyManager.unlockVault(pin);
  };

  const lock = (): void => {
    keyManager.lockVault();
  };

  const withUnlockedKey = async <T,>(
    callback: (key: CryptoKey) => Promise<T> | T
  ): Promise<T> => {
    return await keyManager.withUnlockedKey(callback);
  };

  const value: SecurityContextValue = {
    lockState,
    isUnlocked: lockState === 'unlocked',
    isInitialized,
    failedAttempts,
    setupVault,
    unlock,
    lock,
    withUnlockedKey,
  };

  return <SecurityContext.Provider value={value}>{children}</SecurityContext.Provider>;
};

export function useSecurity(): SecurityContextValue {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
}
