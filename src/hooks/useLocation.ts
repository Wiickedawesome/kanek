import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { useDispatch } from 'react-redux';
import { setLocation } from '@/store/slices/locationSlice';
import type { AppDispatch } from '@/store';

export function useLocation() {
  const dispatch = useDispatch<AppDispatch>();
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status);

      if (status === Location.PermissionStatus.GRANTED) {
        const loc = await Location.getCurrentPositionAsync();
        dispatch(setLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        }));
      }
    })();
  }, [dispatch]);

  return { permissionStatus };
}
