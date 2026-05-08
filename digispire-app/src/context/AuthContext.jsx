import { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
} from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext(null);

// Helper to generate a dummy email from a phone number
const phoneToEmail = (phone) => {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (!cleanPhone) return 'invalid@digispire.in';
  return `${cleanPhone}@digispire.in`;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (firebaseUser) => {
    try {
      const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (snap.exists()) {
        return { uid: firebaseUser.uid, id: snap.id, ...snap.data() };
      }
      return null;
    } catch (err) {
      console.error('Profile fetch error:', err);
      return null;
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const profile = await fetchProfile(firebaseUser);
        setUserProfile(profile);
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const loginAdmin = async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const profile = await fetchProfile(cred.user);
    setUserProfile(profile);
    return { user: cred.user, profile };
  };

  const loginStudent = async (phone, password) => {
    if (!phone || !password) throw { code: 'auth/invalid-email', message: 'Missing credentials' };
    const email = phoneToEmail(phone);
    // Direct login now that Admin creates the account beforehand
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const profile = await fetchProfile(cred.user);
    setUserProfile(profile);
    return { user: cred.user, profile };
  };

  const changeUserPassword = (newPassword) => {
    if (!auth.currentUser) throw new Error('No user logged in');
    return updatePassword(auth.currentUser, newPassword);
  };

  const logout = () => signOut(auth);

  const updateUserProfile = async (updates) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, updates);
    setUserProfile(prev => ({ ...prev, ...updates }));
  };

  return (
    <AuthContext.Provider value={{
      user, userProfile, loading,
      loginAdmin, loginStudent, logout,
      changePassword: changeUserPassword,
      updateProfile: updateUserProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
