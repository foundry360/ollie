import { create } from 'zustand';

type NeighborSignupStep = 
  | 'signup'           // Step 1: Enter name, email, password, phone
  | 'verify-phone'     // Step 2: Verify SMS code
  | 'application'      // Step 3: Enter address/DOB
  | 'pending'          // Step 4: Wait for approval
  | 'complete-profile'; // Step 5: Complete profile after approval

interface NeighborSignupState {
  currentStep: NeighborSignupStep;
  // Step 1 data
  email: string;
  full_name: string;
  password: string;
  phone: string;
  userId: string | null; // Auth user ID
  // Step 2 data
  phoneVerified: boolean;
  // Step 3 data
  address: string;
  date_of_birth: string | null;
  // Application tracking
  applicationId: string | null;
  // Actions
  setCurrentStep: (step: NeighborSignupStep) => void;
  setSignupData: (data: { email: string; full_name: string; password: string; phone: string; userId: string }) => void;
  setPhoneVerified: (verified: boolean) => void;
  setApplicationData: (data: { address: string; date_of_birth: string | null }) => void;
  setApplicationId: (id: string) => void;
  reset: () => void;
}

const initialState = {
  currentStep: 'signup' as NeighborSignupStep,
  email: '',
  full_name: '',
  password: '',
  phone: '',
  userId: null,
  phoneVerified: false,
  address: '',
  date_of_birth: null,
  applicationId: null,
};

export const useNeighborSignupStore = create<NeighborSignupState>((set) => ({
  ...initialState,
  
  setCurrentStep: (step) => set({ currentStep: step }),
  
  setSignupData: (data) => set({
    email: data.email,
    full_name: data.full_name,
    password: data.password,
    phone: data.phone,
    userId: data.userId,
  }),
  
  setPhoneVerified: (verified) => set({ phoneVerified: verified }),
  
  setApplicationData: (data) => set({
    address: data.address,
    date_of_birth: data.date_of_birth,
  }),
  
  setApplicationId: (id) => set({ applicationId: id }),
  
  reset: () => set(initialState),
}));
