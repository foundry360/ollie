// Stub for @stripe/stripe-react-native on web platform
// Stripe React Native only works on native platforms, not web

export const useStripe = () => ({
  initPaymentSheet: () => Promise.resolve({ error: { code: 'WebNotSupported', message: 'Stripe not supported on web' } }),
  presentPaymentSheet: () => Promise.resolve({ error: { code: 'WebNotSupported' } }),
  retrieveSetupIntent: () => Promise.resolve({ error: { code: 'WebNotSupported' } }),
});

export const StripeProvider = ({ children }) => children;

export default {
  useStripe,
  StripeProvider,
};




