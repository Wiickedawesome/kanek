import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface DriverLocationUpdate {
  userId: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

interface LocationState {
  /** Current user's own position */
  latitude: number | null;
  longitude: number | null;
  /** Whether the driver is actively broadcasting location */
  isTracking: boolean;
  /** Contract ID being tracked (driver side) */
  activeContractId: string | null;
  /** Driver's latest broadcast location (rider/passenger side) */
  driverLocation: DriverLocationUpdate | null;
}

const initialState: LocationState = {
  latitude: null,
  longitude: null,
  isTracking: false,
  activeContractId: null,
  driverLocation: null,
};

const locationSlice = createSlice({
  name: 'location',
  initialState,
  reducers: {
    setLocation(state, action: PayloadAction<{ latitude: number; longitude: number }>) {
      state.latitude = action.payload.latitude;
      state.longitude = action.payload.longitude;
    },
    setTracking(state, action: PayloadAction<boolean>) {
      state.isTracking = action.payload;
    },
    setActiveContractId(state, action: PayloadAction<string | null>) {
      state.activeContractId = action.payload;
      if (!action.payload) {
        state.driverLocation = null;
      }
    },
    setDriverLocation(state, action: PayloadAction<DriverLocationUpdate | null>) {
      state.driverLocation = action.payload;
    },
    resetLocation() {
      return initialState;
    },
  },
});

export const { setLocation, setTracking, setActiveContractId, setDriverLocation, resetLocation } =
  locationSlice.actions;
export default locationSlice.reducer;
