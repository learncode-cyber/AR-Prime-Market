# ✅ FEATURE 12: Mobile App (React Native/Expo)
## iOS + Android Native App

**Status:** Setup guide & architecture ready
**Framework:** React Native + Expo
**Time to deploy:** 10-14 days
**Expected impact:** +30-40% traffic from mobile

---

## 🚀 Quick Setup

### Prerequisites
```bash
# Install Node.js 18+
# Install Expo CLI
npm install -g expo-cli

# Install EAS CLI for building
npm install -g eas-cli
```

### Create Project
```bash
# Create React Native app
npx create-expo-app ar-prime-market

# Install dependencies
npm install
npm install @react-native-async-storage/async-storage
npm install @supabase/supabase-js
npm install react-native-safe-area-context
npm install react-native-screens
npm install @react-navigation/native
npm install @react-navigation/bottom-tabs
npm install axios
npm install firebase  # For push notifications
```

### Project Structure
```
mobile-app/
├── src/
│   ├── screens/
│   │   ├── HomeScreen.tsx
│   │   ├── ProductsScreen.tsx
│   │   ├── CartScreen.tsx
│   │   ├── OrdersScreen.tsx
│   │   ├── ProfileScreen.tsx
│   │   └── SearchScreen.tsx
│   ├── components/
│   │   ├── ProductCard.tsx
│   │   ├── CartItem.tsx
│   │   ├── OrderCard.tsx
│   │   └── Header.tsx
│   ├── services/
│   │   ├── api.ts (API calls)
│   │   ├── auth.ts (Authentication)
│   │   ├── storage.ts (Local storage)
│   │   └── notifications.ts (Push notifications)
│   ├── navigation/
│   │   └── RootNavigator.tsx
│   ├── context/
│   │   ├── AuthContext.tsx
│   │   ├── CartContext.tsx
│   │   └── UserContext.tsx
│   ├── types/
│   │   └── index.ts
│   └── App.tsx
├── app.json
├── eas.json
└── package.json
```

---

## 📱 Key Features

### 1. Authentication
```typescript
// Supabase Auth with mobile
import { supabase } from '@/services/api'

const signUp = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })
  
  if (error) throw error
  return data
}

const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  
  if (error) throw error
  return data
}
```

### 2. Product Listing
```typescript
// Browse products with filtering
const getProducts = async (category?: string, search?: string) => {
  let query = supabase.from('products').select('*')
  
  if (category) query = query.eq('category', category)
  if (search) query = query.ilike('title', `%${search}%`)
  
  const { data, error } = await query.limit(20)
  
  if (error) throw error
  return data
}
```

### 3. Shopping Cart
```typescript
// Context-based cart management
import { useCart } from '@/context/CartContext'

export function CartScreen() {
  const { items, total, addItem, removeItem, checkout } = useCart()
  
  return (
    <View>
      {items.map(item => (
        <CartItem key={item.id} item={item} />
      ))}
      <Text>${total}</Text>
      <Button onPress={checkout} title="Checkout" />
    </View>
  )
}
```

### 4. Biometric Login
```typescript
import * as LocalAuthentication from 'expo-local-authentication'

const enableBiometric = async () => {
  const compatible = await LocalAuthentication.hasHardwareAsync()
  const enrolled = await LocalAuthentication.isEnrolledAsync()
  
  if (compatible && enrolled) {
    const result = await LocalAuthentication.authenticateAsync({
      disableDeviceFallback: true,
      reason: 'Login to AR Prime Market',
    })
    
    return result.success
  }
}
```

### 5. Push Notifications
```typescript
import * as Notifications from 'expo-notifications'
import { getExpoPushTokenAsync } from 'expo-notifications'

const registerForPushNotifications = async () => {
  const token = await getExpoPushTokenAsync()
  
  // Send token to backend
  await fetch('/api/notifications/register', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}
```

### 6. QR Code Scanning
```typescript
import { CameraView, useCameraPermissions } from 'expo-camera'

export function QRScanner() {
  const [permission, requestPermission] = useCameraPermissions()
  
  if (!permission?.granted) {
    requestPermission()
  }
  
  return (
    <CameraView
      facing="back"
      onBarcodeScanned={({ data }) => {
        // Process QR code (product, order, promo)
        console.log('Scanned:', data)
      }}
    />
  )
}
```

### 7. Offline Mode
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage'

const cacheData = async (key: string, data: any) => {
  await AsyncStorage.setItem(key, JSON.stringify(data))
}

const getCachedData = async (key: string) => {
  const data = await AsyncStorage.getItem(key)
  return data ? JSON.parse(data) : null
}

// Use cached data when offline
const getProducts = async () => {
  try {
    return await fetchFromAPI('/products')
  } catch (error) {
    return getCachedData('products')
  }
}
```

---

## 🔧 Configuration

### app.json
```json
{
  "expo": {
    "name": "AR Prime Market",
    "slug": "ar-prime-market",
    "version": "1.0.0",
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTabletMode": true,
      "bundleIdentifier": "com.arprimemarket.app"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.arprimemarket.app"
    },
    "plugins": [
      "expo-notifications",
      "expo-camera",
      "expo-local-authentication"
    ]
  }
}
```

### eas.json
```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      },
      "ios": {
        "simulator": true
      }
    },
    "preview2": {
      "android": {
        "gradleCommand": ":app:assembleRelease"
      }
    },
    "preview3": {
      "developmentClient": true
    },
    "production": {}
  },
  "submit": {
    "production": {}
  }
}
```

---

## 📈 Performance Optimization

### 1. Image Optimization
```typescript
// Use optimized images
import { Image } from 'react-native'

<Image
  source={{ uri: product.image }}
  style={{ width: 200, height: 200 }}
  resizeMode="contain"
/>
```

### 2. FlatList for Lists
```typescript
import { FlatList } from 'react-native'

<FlatList
  data={products}
  renderItem={({ item }) => <ProductCard product={item} />}
  keyExtractor={(item) => item.id}
  onEndReached={loadMore}
  removeClippedSubviews={true}
/>
```

### 3. Code Splitting
```typescript
// Dynamic imports
const CheckoutScreen = lazy(() => import('./CheckoutScreen'))
const AdminPanel = lazy(() => import('./AdminPanel'))
```

---

## 🚀 Build & Deploy

### Local Testing
```bash
# Run on iOS
npm run ios

# Run on Android
npm run android

# Expose to local network
npx expo start --localhost
```

### Build for Production
```bash
# Build iOS
eas build --platform ios

# Build Android
eas build --platform android

# Publish
eas submit --platform ios
eas submit --platform android
```

---

## 📊 Expected Metrics

```
Users from mobile:      30-40% additional
Average session time:   +25% vs web
Conversion rate:        +15% vs web
Push notification CTR:  45-60%
Retention rate (30d):   +20%
App store rating:       4.5+ stars target
```

---

## ✅ Checklist Before Launch

```
App Development:
☐ All screens implemented
☐ Navigation working
☐ Auth functional
☐ Payment integration done
☐ Push notifications working
☐ Offline mode tested
☐ QR scanner tested

Testing:
☐ Unit tests (80%+ coverage)
☐ Integration tests
☐ E2E tests on real devices
☐ Performance testing
☐ Accessibility audit

Deployment:
☐ iOS TestFlight builds
☐ Android internal testing
☐ App Store compliance check
☐ Google Play compliance check
☐ Privacy policy updated
☐ Terms updated

Post-Launch:
☐ App analytics setup
☐ Error tracking (Sentry)
☐ Crash monitoring
☐ User feedback collection
☐ Version update strategy
```

---

## 💡 Pro Tips

1. **Use Expo Go** during development
2. **Bare workflow** when you need native code
3. **Test on real devices** before launch
4. **Monitor app performance** with Sentry
5. **Plan for app updates** strategy
6. **Use EAS** for CI/CD pipeline
7. **Keep app size < 100MB**
8. **Optimize bundle size**

---

## 📚 Resources

- [React Native Docs](https://reactnative.dev)
- [Expo Docs](https://docs.expo.dev)
- [React Navigation](https://reactnavigation.org)
- [EAS Build](https://docs.expo.dev/build/introduction/)

---

**Total development time: 10-14 days**
**Expected ROI: +30-40% mobile traffic**
**Ready to start? Get all assets and begin development!**

