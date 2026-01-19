/**
 * Route Service
 * Business logic for route management
 * Placeholder - to be implemented in Week 3
 */

import { routesApi } from '@/api/routes.api';
import { AppDispatch } from '@/store';
import {
  fetchRoutesStart,
  fetchRoutesSuccess,
  fetchRoutesFailure,
  assignRoute as assignRouteAction,
} from '@/store/slices/route.slice';

export const routeService = {
  /**
   * Fetch available routes
   */
  fetchAvailableRoutes: async (dispatch: AppDispatch) => {
    dispatch(fetchRoutesStart());
    try {
      const routes = await routesApi.getAvailableRoutes();
      dispatch(fetchRoutesSuccess(routes));
      return { success: true, routes };
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch routes';
      dispatch(fetchRoutesFailure(errorMessage));
      return { success: false, error: errorMessage };
    }
  },

  /**
   * Assign route to driver
   */
  assignRoute: async (routeId: string, dispatch: AppDispatch) => {
    try {
      const assignment = await routesApi.assignRoute(routeId);
      const route = await routesApi.getRouteDetails(routeId);
      dispatch(assignRouteAction({ route, assignment }));
      return { success: true, route, assignment };
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to assign route';
      return { success: false, error: errorMessage };
    }
  },
};

