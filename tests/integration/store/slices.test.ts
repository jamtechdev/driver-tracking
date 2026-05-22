import authReducer, {
  loginStart,
  loginSuccess,
  loginFailure,
  logout,
  setSupervisorMode,
} from '@/store/slices/auth.slice';
import routeReducer, {
  fetchRoutesStart,
  fetchRoutesSuccess,
  assignRoute,
  clearAssignedRoute,
} from '@/store/slices/route.slice';
import passengerReducer, {
  incrementPassenger,
  setPassengerCount,
  clearTallies,
} from '@/store/slices/passenger.slice';
import messagingReducer, {
  setMessages,
  markAsRead,
  toggleTTS,
} from '@/store/slices/messaging.slice';
import settingsReducer, { setBrightness, resetSettings } from '@/store/slices/settings.slice';
import inspectionReducer, {
  setPreTripForm,
  updateInspectionItem,
  resetInspection,
} from '@/store/slices/inspection.slice';
import locationReducer, {
  setLocation,
  startTracking,
  setLocationError,
} from '@/store/slices/location.slice';
import mapReducer, {
  setRegion,
  setRouteShape,
  toggleRouteVisibility,
  resetMap,
} from '@/store/slices/map.slice';
import type { Route, RouteAssignment } from '@/api/routes.api';
import type { Message } from '@/api/messaging.api';
import type { InspectionForm } from '@/api/inspection.api';

describe('Redux slices', () => {
  describe('auth', () => {
    it('handles login flow', () => {
      let state = authReducer(undefined, loginStart());
      expect(state.isLoading).toBe(true);
      state = authReducer(
        state,
        loginSuccess({
          user: { id: '1', name: 'D', role: 'driver' },
          token: 't',
        }),
      );
      expect(state.isAuthenticated).toBe(true);
      expect(state.token).toBe('t');
      state = authReducer(state, logout());
      expect(state.isAuthenticated).toBe(false);
    });

    it('setSupervisorMode toggles flag', () => {
      let state = authReducer(undefined, setSupervisorMode(true));
      expect(state.isSupervisorMode).toBe(true);
    });
  });

  describe('route', () => {
    it('assigns route and clears', () => {
      const route: Route = {
        id: 'r1',
        name: 'R',
        routeNumber: '1',
        startTime: '',
        endTime: '',
        stops: [],
        shape: [],
      };
      const assignment: RouteAssignment = {
        routeId: 'r1',
        driverId: 'd1',
        assignedAt: new Date().toISOString(),
      };
      let state = routeReducer(undefined, fetchRoutesStart());
      expect(state.isLoading).toBe(true);
      state = routeReducer(state, fetchRoutesSuccess([route]));
      expect(state.availableRoutes).toHaveLength(1);
      state = routeReducer(state, assignRoute({ route, assignment }));
      expect(state.assignedRoute?.id).toBe('r1');
      state = routeReducer(state, clearAssignedRoute());
      expect(state.assignedRoute).toBeNull();
    });
  });

  describe('passenger', () => {
    it('increments and clears', () => {
      let state = passengerReducer(undefined, incrementPassenger());
      expect(state.currentCount).toBe(1);
      state = passengerReducer(state, setPassengerCount(5));
      expect(state.currentCount).toBe(5);
      state = passengerReducer(state, clearTallies());
      expect(state.currentCount).toBe(0);
    });
  });

  describe('messaging', () => {
    const msg = (over: Partial<Message> = {}): Message => ({
      id: 'm1',
      type: 'system',
      content: 'hi',
      timestamp: new Date().toISOString(),
      read: false,
      ...over,
    });

    it('tracks unread and markAsRead', () => {
      let state = messagingReducer(undefined, setMessages([msg(), msg({ id: 'm2', read: true })]));
      expect(state.unreadCount).toBe(1);
      state = messagingReducer(state, markAsRead('m1'));
      expect(state.unreadCount).toBe(0);
    });

    it('toggleTTS flips flag', () => {
      let state = messagingReducer(undefined, toggleTTS());
      expect(state.isTTSEnabled).toBe(false);
    });
  });

  describe('settings', () => {
    it('clamps brightness and resets', () => {
      let state = settingsReducer(undefined, setBrightness(500));
      expect(state.brightness).toBe(100);
      state = settingsReducer(state, resetSettings());
      expect(state.brightness).toBe(100);
    });
  });

  describe('inspection', () => {
    const form: InspectionForm = {
      type: 'pre-trip',
      routeId: 'r',
      vehicleId: 'v',
      items: [{ id: 'i1', name: 'Tire', category: 'x', required: true, status: 'na' }],
      timestamp: '',
    };

    it('updates item on current form', () => {
      let state = inspectionReducer(undefined, setPreTripForm(form));
      state = inspectionReducer(
        state,
        updateInspectionItem({ itemId: 'i1', updates: { status: 'pass' } }),
      );
      expect(state.currentForm?.items[0].status).toBe('pass');
      state = inspectionReducer(state, resetInspection());
      expect(state.currentForm).toBeNull();
    });
  });

  describe('location', () => {
    it('sets location and errors', () => {
      let state = locationReducer(undefined, setLocation({ latitude: 1, longitude: 2 }));
      expect(state.currentLocation).toEqual({ latitude: 1, longitude: 2 });
      state = locationReducer(state, startTracking());
      expect(state.isTracking).toBe(true);
      state = locationReducer(state, setLocationError('gps'));
      expect(state.error).toBe('gps');
    });
  });

  describe('map', () => {
    it('toggles route visibility and resets', () => {
      let state = mapReducer(undefined, setRegion({ latitude: 10, longitude: 20 }));
      expect(state.region.latitude).toBe(10);
      state = mapReducer(state, setRouteShape([{ latitude: 1, longitude: 2 }]));
      expect(state.routeShape).toHaveLength(1);
      const before = state.showRoute;
      state = mapReducer(state, toggleRouteVisibility());
      expect(state.showRoute).toBe(!before);
      state = mapReducer(state, resetMap());
      expect(state.routeShape).toHaveLength(0);
    });
  });
});
