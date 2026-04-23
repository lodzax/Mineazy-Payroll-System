import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { auth, db } from './firebase';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  profile: null, 
  loading: true, 
  isAdmin: false,
  isSuperAdmin: false
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const docRef = doc(db, 'users', u.uid);
        let docSnap = await getDoc(docRef);
        
        let profileData: any = null;

        if (docSnap.exists()) {
          profileData = docSnap.data();
          
          // Force Super Admin status for the specific emails to stay in sync
          if ((u.email === 'lodzax@gmail.com' || u.email === 'accounts@mineazy.co.zw') && (profileData.role !== 'admin' || profileData.subsidiaryId)) {
            profileData = {
              ...profileData,
              role: 'admin',
              fullName: profileData.fullName || (u.email === 'accounts@mineazy.co.zw' ? 'Mwale' : 'Lloyd Magora')
            };
            if (profileData.subsidiaryId) delete profileData.subsidiaryId;
            await setDoc(docRef, profileData);
          }
          setProfile(profileData);
        } else {
          const q = query(collection(db, 'users'), where('email', '==', u.email));
          const querySnap = await getDocs(q);
          
          if (!querySnap.empty) {
            const existingData = querySnap.docs[0].data();
            profileData = { 
              ...existingData, 
              uid: u.uid,
              fullName: u.email === 'accounts@mineazy.co.zw' ? 'Mwale' : (u.email === 'lodzax@gmail.com' ? 'Lloyd Magora' : (existingData.fullName || u.displayName || 'Unnamed User'))
            };
            
            if (u.email === 'lodzax@gmail.com' || u.email === 'accounts@mineazy.co.zw') {
              profileData.role = 'admin';
              if (profileData.subsidiaryId) delete profileData.subsidiaryId;
            }

            await setDoc(docRef, profileData);
            setProfile(profileData);
          } else {
            const isOfficialAdmin = u.email === 'lodzax@gmail.com' || u.email === 'accounts@mineazy.co.zw';
            const initialProfile: any = {
              uid: u.uid,
              email: u.email,
              fullName: u.email === 'accounts@mineazy.co.zw' ? 'Mwale' : (isOfficialAdmin ? 'Lloyd Magora' : (u.displayName || 'Unnamed User')),
              role: isOfficialAdmin ? 'admin' : 'employee',
              currency: 'USD',
              baseSalary: 1000
            };
            await setDoc(doc(db, 'users', u.uid), initialProfile);
            setProfile(initialProfile);
          }
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  const isSuperAdmin = user?.email === 'lodzax@gmail.com' || user?.email === 'accounts@mineazy.co.zw';
  const isAdmin = isSuperAdmin || profile?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isSuperAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
