import { create } from 'zustand';

type OnboardingStep = 'age' | 'details';

interface SignupStore {
  currentStep: OnboardingStep;
  setCurrentStep: (step: OnboardingStep) => void;
  reset: () => void;
}

export const useSignupStore = create<SignupStore>((set) => ({
  currentStep: 'age',
  setCurrentStep: (step: OnboardingStep) => set({ currentStep: step }),
  reset: () => set({ currentStep: 'age' }),
}));

