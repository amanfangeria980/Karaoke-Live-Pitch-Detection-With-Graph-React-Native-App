import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions } from 'react-native';
import { Audio } from 'expo-av';
import { LineChart } from 'react-native-chart-kit';
import { StatusBar } from 'expo-status-bar';
import { AntDesign, Ionicons } from '@expo/vector-icons';

const RECORDING_TIME_LIMIT = 60000; // 60 seconds in milliseconds
const REFRESH_INTERVAL = 100; // 100ms, adjust as needed
const MAX_DATA_POINTS = 600; // 60 seconds * 10 data points per second

export default function App() {
  const [recording, setRecording] = useState();
  const [pitch, setPitch] = useState(null);
  const [pitchData, setPitchData] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const intervalRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  async function startRecording() {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(newRecording);

      await newRecording.startAsync();
      setIsRecording(true);
      setPitchData([]);
      setElapsedTime(0);

      intervalRef.current = setInterval(async () => {
        if (newRecording) {
          const status = await newRecording.getStatusAsync();
          onRecordingStatusUpdate(status);
        }
      }, REFRESH_INTERVAL);

      timerRef.current = setTimeout(() => {
        stopRecording();
      }, RECORDING_TIME_LIMIT);

      // Start elapsed time counter
      const startTime = Date.now();
      const timeInterval = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 1000);

      timerRef.current = { timeout: timerRef.current, interval: timeInterval };
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  }

  async function stopRecording() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current.timeout);
      clearInterval(timerRef.current.interval);
      timerRef.current = null;
    }

    if (recording) {
      try {
        await recording.stopAndUnloadAsync();
      } catch (err) {
        console.error('Error stopping recording:', err);
      }
    }

    setRecording(undefined);
    setIsRecording(false);
  }

  function onRecordingStatusUpdate(status) {
    if (status.isRecording) {
      const metering = status.metering;
      if (typeof metering === 'number') {
        const normalizedPitch = normalizePitch(metering);
        setPitch(normalizedPitch);
        updatePitchData(normalizedPitch);
      }
    }
  }

  function normalizePitch(metering) {
    const minDb = -60;
    const maxDb = -10;
    const clampedMetering = Math.max(minDb, Math.min(maxDb, metering));
    let normalizedValue = ((clampedMetering - minDb) / (maxDb - minDb)) * 100;
    normalizedValue = Math.pow(normalizedValue / 100, 0.5) * 100;
    return Math.max(0, Math.min(100, normalizedValue));
  }

  function updatePitchData(newPitch) {
    setPitchData((currentData) => {
      const updatedData = [...currentData, newPitch];
      if (updatedData.length > MAX_DATA_POINTS) {
        return updatedData.slice(-MAX_DATA_POINTS);
      }
      return updatedData;
    });
  }

  function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <TouchableOpacity>
          <AntDesign name="left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recordings</Text>
        <TouchableOpacity>
          <AntDesign name="plus" size={24} color="white" />
        </TouchableOpacity>
      </View>
      <View style={styles.chartContainer}>
        <LineChart
          data={{
            labels: [],
            datasets: [{ data: pitchData.length > 0 ? pitchData : [0] }],
          }}
          width={Dimensions.get('window').width}
          height={250}
          yAxisLabel=""
          yAxisSuffix=""
          yAxisInterval={1}
          chartConfig={{
            backgroundColor: '#670000',
            backgroundGradientFrom: '#670000',
            backgroundGradientTo: '#670000',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
            style: {
              borderRadius: 16,
            },
            propsForDots: {
              r: '0',
            },
            propsForBackgroundLines: {
              strokeWidth: 1,
              stroke: 'rgba(255, 255, 255, 0.3)',
              strokeDasharray: '0',
            },
            propsForLabels: {
              fontWeight: 'normal',
              fontSize: 10,
            },
          }}
          bezier
          style={{
            marginVertical: 8,
            borderRadius: 0,
          }}
          withVerticalLabels={false}
          withHorizontalLabels={true}
          fromZero={true}
          segments={3}
        />
        <View style={styles.yAxis}>
          <Text style={styles.yAxisLabel}>75</Text>
          <Text style={styles.yAxisLabel}>50</Text>
          <Text style={styles.yAxisLabel}>25</Text>
          <Text style={styles.yAxisLabel}>0</Text>
        </View>
      </View>
      <View style={styles.timeContainer}>
        <Text style={styles.timeText}>{formatTime(elapsedTime)}</Text>
        <Text style={styles.timeText}>1:00</Text>
      </View>
      <View style={styles.controlsContainer}>
        <TouchableOpacity style={styles.controlButton}>
          <Ionicons name="close" size={24} color="#FF9B9B" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.recordButton, isRecording ? styles.stopButton : {}]}
          onPress={isRecording ? stopRecording : startRecording}>
          {isRecording ? (
            <Ionicons name="pause" size={32} color="white" />
          ) : (
            <View style={styles.recordIcon} />
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton}>
          <Ionicons name="checkmark" size={24} color="#FF9B9B" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#670000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  chartContainer: {
    position: 'relative',
  },
  yAxis: {
    position: 'absolute',
    left: 10,
    top: 10,
    bottom: 20,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  yAxisLabel: {
    color: 'white',
    fontSize: 10,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: -20,
  },
  timeText: {
    color: 'white',
    fontSize: 16,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 40,
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FF9B9B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: '#FF6B6B',
  },
  recordIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'white',
  },
});
