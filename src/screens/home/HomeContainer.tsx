import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import MainLayout from '../../components/MainLayout';
import TabHeader from '../../components/TabHeader';
import HomeScreen from './HomeScreen';
import MapScreen from '../map/MapScreen';

interface HomeContainerProps {
  navigation: any;
}

const HomeContainer: React.FC<HomeContainerProps> = ({ navigation }) => {
  const [currentTab, setCurrentTab] = useState<'home' | 'map'>('home');

  return (
    <MainLayout
      navigation={navigation}
      currentTab={currentTab}
      onTabChange={setCurrentTab}
    >
      <TabHeader />
      <View style={styles.container}>
        {currentTab === 'home' ? (
          <HomeScreen navigation={navigation} />
        ) : (
          <MapScreen navigation={navigation} isTabView />
        )}
      </View>
    </MainLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default HomeContainer;
