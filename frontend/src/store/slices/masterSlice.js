/**
 * Master data slice - cached state for dropdowns and filters
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient, { getErrorMessage } from '../../utils/api.js';

const initialState = {
  companies: [],
  warehouses: [],
  godowns: [],
  products: [],
  vendors: [],
  customers: [],
  transporters: [],
  priceLists: [],
  taxMasters: [],
  isLoading: false,
  error: null,
  lastUpdated: null,
};

/**
 * Async thunks for loading master data
 */
export const loadCompanies = createAsyncThunk(
  'master/loadCompanies',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get('/master/companies/');
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const loadWarehouses = createAsyncThunk(
  'master/loadWarehouses',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get('/master/warehouses/');
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const loadGodowns = createAsyncThunk(
  'master/loadGodowns',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get('/master/godowns/');
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const loadProducts = createAsyncThunk(
  'master/loadProducts',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await apiClient.get('/master/products/', { params });
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const loadVendors = createAsyncThunk(
  'master/loadVendors',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get('/master/vendors/');
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const loadCustomers = createAsyncThunk(
  'master/loadCustomers',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get('/master/customers/');
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const loadTransporters = createAsyncThunk(
  'master/loadTransporters',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get('/master/transporters/');
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const loadPriceLists = createAsyncThunk(
  'master/loadPriceLists',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get('/master/price-lists/');
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const loadTaxMasters = createAsyncThunk(
  'master/loadTaxMasters',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get('/master/tax-masters/');
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

/**
 * Master slice reducer
 */
const masterSlice = createSlice({
  name: 'master',
  initialState,
  reducers: {
    clearMasterData: (state) => {
      state.companies = [];
      state.warehouses = [];
      state.godowns = [];
      state.products = [];
      state.vendors = [];
      state.customers = [];
      state.transporters = [];
      state.priceLists = [];
      state.taxMasters = [];
      state.lastUpdated = null;
    },
  },

  extraReducers: (builder) => {
    // Companies
    builder
      .addCase(loadCompanies.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadCompanies.fulfilled, (state, action) => {
        state.isLoading = false;
        state.companies = action.payload.results || action.payload;
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(loadCompanies.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    // Warehouses
    builder
      .addCase(loadWarehouses.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadWarehouses.fulfilled, (state, action) => {
        state.isLoading = false;
        state.warehouses = action.payload.results || action.payload;
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(loadWarehouses.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    // Godowns
    builder
      .addCase(loadGodowns.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadGodowns.fulfilled, (state, action) => {
        state.isLoading = false;
        state.godowns = action.payload.results || action.payload;
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(loadGodowns.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    // Products
    builder
      .addCase(loadProducts.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadProducts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.products = action.payload.results || action.payload;
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(loadProducts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    // Vendors
    builder
      .addCase(loadVendors.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadVendors.fulfilled, (state, action) => {
        state.isLoading = false;
        state.vendors = action.payload.results || action.payload;
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(loadVendors.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    // Customers
    builder
      .addCase(loadCustomers.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadCustomers.fulfilled, (state, action) => {
        state.isLoading = false;
        state.customers = action.payload.results || action.payload;
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(loadCustomers.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    // Transporters
    builder
      .addCase(loadTransporters.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadTransporters.fulfilled, (state, action) => {
        state.isLoading = false;
        state.transporters = action.payload.results || action.payload;
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(loadTransporters.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    // Price Lists
    builder
      .addCase(loadPriceLists.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadPriceLists.fulfilled, (state, action) => {
        state.isLoading = false;
        state.priceLists = action.payload.results || action.payload;
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(loadPriceLists.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    // Tax Masters
    builder
      .addCase(loadTaxMasters.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadTaxMasters.fulfilled, (state, action) => {
        state.isLoading = false;
        state.taxMasters = action.payload.results || action.payload;
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(loadTaxMasters.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const { clearMasterData } = masterSlice.actions;

export default masterSlice.reducer;
