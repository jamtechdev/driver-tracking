# Driver Tracking App

React Native application for driver route tracking and management. Built with TypeScript, Redux Toolkit, and Google Maps integration.

## Project Overview

This is a 12-week project divided into three milestones:

- **Milestone 1 (Weeks 1–4)**: Foundation, Authentication, Route Assignment, Passenger & Fare System
- **Milestone 2 (Weeks 5–8)**: Maps, GPS, Messaging, Operational Tools
- **Milestone 3 (Weeks 9–12)**: Optimization, Device Scaling, QA, Store Readiness

## Tech Stack

- **React Native** 0.83.1
- **TypeScript**
- **Redux Toolkit** - State management
- **React Navigation** - Navigation
- **Google Maps** (react-native-maps) - Maps and location
- **Axios** - HTTP client
- **Jest + Detox** - Testing

## Prerequisites

- Node.js >= 20
- React Native development environment set up
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)
- Google Maps API key

## Getting Started

### 1. Install Dependencies

```sh
npm install
# or
yarn install
```

### 2. iOS Setup

```sh
cd ios
bundle install
bundle exec pod install
cd ..
```

### 3. Environment Configuration

Copy `.env.example` to `.env` and fill in your configuration:

```sh
cp .env.example .env
```

Update the following in `.env`:
- `GOOGLE_MAPS_API_KEY` - Your Google Maps API key
- `API_BASE_URL` - Your backend API URL

### 4. Android Google Maps Configuration

Update `android/app/src/main/AndroidManifest.xml` and replace `YOUR_GOOGLE_MAPS_API_KEY` with your actual Google Maps API key.

### 5. iOS Google Maps Configuration

Update `ios/DriverTracking/AppDelegate.swift` to add your Google Maps API key (instructions will be provided in Week 5).

### 6. Start Metro Bundler

```sh
npm start
# or
yarn start
```

### 7. Run the App

**Android:**
```sh
npm run android
# or
yarn android
```

**iOS:**
```sh
npm run ios
# or
yarn ios
```

## Available Scripts

- `npm start` - Start Metro bundler
- `npm run android` - Run on Android
- `npm run ios` - Run on iOS
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run type-check` - Run TypeScript type checking
- `npm run clean` - Clean build artifacts

## Project Structure

```
src/
├── api/              # API layer (client, endpoints, API calls)
├── components/        # Reusable UI components
├── screens/           # Screen components
├── navigation/        # Navigation configuration
├── store/             # Redux store and slices
├── services/          # Business logic services
├── hooks/             # Custom React hooks
├── utils/             # Utility functions
├── types/             # TypeScript type definitions
└── config/            # Configuration files
```

## Development Status

### ✅ Completed (Week 1)
- Project initialization
- Folder structure setup
- Redux store configuration
- Navigation structure
- API client setup
- Configuration files
- Basic screen placeholders

### 🚧 In Progress
- Native module configuration
- Testing framework setup

### 📋 Upcoming
- Week 2: Authentication module
- Week 3: Route assignment system
- Week 4: Passenger & fare tallying

## Permissions

The app requires the following permissions:

- **Location** (Foreground & Background) - For GPS tracking
- **Internet** - For API communication
- **Vibrate** - For notifications

## Testing

### Unit Tests
```sh
npm test
```

### E2E Tests (Detox)
```sh
# Build and run E2E tests
detox build -c android.emu.debug
detox test -c android.emu.debug
```

## Contributing

This project follows the milestone timeline. Development should proceed according to the plan outlined in the project documentation.

## License

Private project - All rights reserved
