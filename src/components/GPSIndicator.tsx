import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface GPSIndicatorProps {
    color?: string;
    isHighAccuracy?: boolean;
}

/**
 * GPS Indicator - Pulsing green dot with accuracy-based glow
 * Simulates active/accurate GPS signal
 */
const GPSIndicator: React.FC<GPSIndicatorProps> = ({
    color = '#22C55E', // Default to green
    isHighAccuracy = true
}) => {
    const pulseAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isHighAccuracy) {
            const animation = Animated.loop(
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 2000,
                    useNativeDriver: true,
                })
            );
            animation.start();
            return () => animation.stop();
        } else {
            pulseAnim.setValue(0);
        }
    }, [pulseAnim, isHighAccuracy]);

    const scale = pulseAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 4],
    });

    const opacity = pulseAnim.interpolate({
        inputRange: [0, 0.1, 1],
        outputRange: [0, 0.4, 0],
    });

    return (
        <View style={styles.container}>
            {isHighAccuracy && (
                <Animated.View
                    style={[
                        styles.pulse,
                        {
                            backgroundColor: color,
                            transform: [{ scale }],
                            opacity,
                        },
                    ]}
                />
            )}
            <View
                style={[
                    styles.dot,
                    {
                        backgroundColor: color,
                        shadowColor: isHighAccuracy ? color : 'transparent',
                        shadowOpacity: isHighAccuracy ? 0.8 : 0,
                        elevation: isHighAccuracy ? 3 : 0,
                    },
                ]}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
        zIndex: 2,
        shadowOffset: { width: 0, height: 0 },
        shadowRadius: 2,
    },
    pulse: {
        position: 'absolute',
        width: 10,
        height: 10,
        borderRadius: 5,
        zIndex: 1,
    },
});

export default GPSIndicator;
