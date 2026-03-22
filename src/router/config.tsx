import { lazy } from 'react';
import { RouteObject, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import AdminRoute from '../components/AdminRoute';

const Home = lazy(() => import('../pages/home/page'));
const HowItWorks = lazy(() => import('../pages/how-it-works/page'));
const SignIn = lazy(() => import('../pages/signin/page'));
const SignUp = lazy(() => import('../pages/signup/page'));
const Dashboard = lazy(() => import('../pages/dashboard/page'));
const MyDataPage = lazy(() => import('../pages/dashboard/MyDataPage'));
const Wallet = lazy(() => import('../pages/wallet/page'));
const Transactions = lazy(() => import('../pages/transactions/page'));
const Cards = lazy(() => import('../pages/cards/page'));
const CreateVirtualCard = lazy(() => import('../pages/cards/CreateVirtualCardPage'));
const Transfer = lazy(() => import('../pages/transfer/page'));
const Profile = lazy(() => import('../pages/profile/page'));
const PersonalInfo = lazy(() => import('../pages/profile/personal/page'));
const PaymentsInfo = lazy(() => import('../pages/profile/payments/page'));
const SecuritySettings = lazy(() => import('../pages/profile/security/page'));
const AccessibilitySettings = lazy(() => import('../pages/profile/accessibility/page'));
const LanguageSettings = lazy(() => import('../pages/profile/language/page'));
const PrivacySettings = lazy(() => import('../pages/profile/privacy/page'));
const Onboarding = lazy(() => import('../pages/onboarding/page'));
const Payments = lazy(() => import('../pages/payments/page'));
const Savings = lazy(() => import('../pages/savings/page'));
const Rewards = lazy(() => import('../pages/rewards/page'));
const GiftCards = lazy(() => import('../pages/giftcards/page'));

const AdminDashboard = lazy(() => import('../pages/admin-dashboard/page'));
const AdminOperations = lazy(() => import('../pages/admin-operations/page'));
const AddressBook = lazy(() => import('../pages/address-book/page'));
const Swap = lazy(() => import('../pages/swap/page'));

const FluzTransactions = lazy(() => import('../pages/transactions/FluzTransactionsPage'));
const MerchantSearch = lazy(() => import('../pages/merchants/MerchantSearchPage'));
const ReferralDashboard = lazy(() => import('../pages/referral/ReferralDashboardPage'));
const FluzAddressBook = lazy(() => import('../pages/address/AddressBookPage'));

const AuthCallback = lazy(() => import('../pages/auth/callback/page'));
const Terms = lazy(() => import('../pages/terms/page'));
const Privacy = lazy(() => import('../pages/privacy/page'));
const RefundPolicy = lazy(() => import('../pages/refund-policy/page'));
const AMLPolicy = lazy(() => import('../pages/aml-policy/page'));
const ResetPassword = lazy(() => import('../pages/reset-password/page'));
const ForgotPassword = lazy(() => import('../pages/forgot-password/page'));
const VerifyEmail = lazy(() => import('../pages/verify-email/page'));
const NotFound = lazy(() => import('../pages/NotFound'));
const Notifications = lazy(() => import('../pages/notifications/page'));
const Support = lazy(() => import('../pages/support/page'));
const Calculator = lazy(() => import('../pages/calculator/page'));
const FeatureDetail = lazy(() => import('../pages/feature/page'));
const AdminLogin = lazy(() => import('../pages/admin-login/page'));
const CheckoutSimulatePage = lazy(() => import('../pages/checkout/CheckoutSimulatePage'));

const routes: RouteObject[] = [
  { path: '/', element: <Home /> },
  { path: '/how-it-works', element: <HowItWorks /> },
  { path: '/rates', element: <Navigate to="/calculator" replace /> },
  { path: '/about', element: <Navigate to="/#about" replace /> },
  { path: '/features', element: <Navigate to="/#features" replace /> },
  { path: '/features/:featureId', element: <FeatureDetail /> },
  { path: '/calculator', element: <Calculator /> },
  { path: '/signin', element: <SignIn /> },
  { path: '/signup', element: <SignUp /> },
  { path: '/sign-in', element: <Navigate to="/signin" replace /> },
  { path: '/sign-up', element: <Navigate to="/signup" replace /> },
  { path: '/login', element: <Navigate to="/signin" replace /> },
  { path: '/register', element: <Navigate to="/signup" replace /> },
  { path: '/reset-password', element: <ResetPassword /> },
  { path: '/forgot-password', element: <ForgotPassword /> },
  { path: '/verify-email', element: <VerifyEmail /> },
  { path: '/auth/callback', element: <AuthCallback /> },
  { path: '/onboarding', element: <Onboarding /> },
  { path: '/checkout/simulate/:id', element: <CheckoutSimulatePage /> },

  {
    path: '/dashboard',
    element: <ProtectedRoute><Dashboard /></ProtectedRoute>,
  },
  {
    path: '/dashboard/data',
    element: <ProtectedRoute><MyDataPage /></ProtectedRoute>,
  },
  {
    path: '/wallet',
    element: <ProtectedRoute><Wallet /></ProtectedRoute>,
  },
  {
    path: '/transactions',
    element: <ProtectedRoute><Transactions /></ProtectedRoute>,
  },
  {
    path: '/cards',
    element: <ProtectedRoute><Cards /></ProtectedRoute>,
  },
  {
    path: '/create-virtual-card',
    element: <ProtectedRoute><CreateVirtualCard /></ProtectedRoute>,
  },
  {
    path: '/transfer',
    element: <ProtectedRoute><Transfer /></ProtectedRoute>,
  },
  {
    path: '/profile',
    element: <ProtectedRoute><Profile /></ProtectedRoute>,
  },
  {
    path: '/profile/personal',
    element: <ProtectedRoute><PersonalInfo /></ProtectedRoute>,
  },
  {
    path: '/profile/payments',
    element: <ProtectedRoute><PaymentsInfo /></ProtectedRoute>,
  },
  {
    path: '/profile/security',
    element: <ProtectedRoute><SecuritySettings /></ProtectedRoute>,
  },
  {
    path: '/profile/accessibility',
    element: <ProtectedRoute><AccessibilitySettings /></ProtectedRoute>,
  },
  {
    path: '/profile/language',
    element: <ProtectedRoute><LanguageSettings /></ProtectedRoute>,
  },
  {
    path: '/profile/notifications',
    element: <ProtectedRoute><Notifications /></ProtectedRoute>,
  },
  {
    path: '/profile/privacy',
    element: <ProtectedRoute><PrivacySettings /></ProtectedRoute>,
  },
  {
    path: '/notifications',
    element: <ProtectedRoute><Notifications /></ProtectedRoute>,
  },
  {
    path: '/support',
    element: <ProtectedRoute><Support /></ProtectedRoute>,
  },
  {
    path: '/payments',
    element: <ProtectedRoute><Payments /></ProtectedRoute>,
  },
  {
    path: '/savings',
    element: <ProtectedRoute><Savings /></ProtectedRoute>,
  },
  {
    path: '/rewards',
    element: <ProtectedRoute><Rewards /></ProtectedRoute>,
  },
  {
    path: '/giftcards',
    element: <ProtectedRoute><GiftCards /></ProtectedRoute>,
  },
  {
    path: '/address-book',
    element: <ProtectedRoute><AddressBook /></ProtectedRoute>,
  },
  {
    path: '/swap',
    element: <ProtectedRoute><Swap /></ProtectedRoute>,
  },
  {
    path: '/fluz/transactions',
    element: <ProtectedRoute><FluzTransactions /></ProtectedRoute>,
  },
  {
    path: '/fluz/merchants',
    element: <ProtectedRoute><MerchantSearch /></ProtectedRoute>,
  },
  {
    path: '/fluz/referral',
    element: <ProtectedRoute><ReferralDashboard /></ProtectedRoute>,
  },
  {
    path: '/fluz/addresses',
    element: <ProtectedRoute><FluzAddressBook /></ProtectedRoute>,
  },

  { path: '/customer-dashboard', element: <Navigate to="/dashboard" replace /> },
  { path: '/customer-wallet', element: <Navigate to="/wallet" replace /> },
  { path: '/customer-transactions', element: <Navigate to="/transactions" replace /> },
  { path: '/customer', element: <Navigate to="/dashboard" replace /> },

  { path: '/admin-login', element: <AdminLogin /> },
  {
    path: '/admin-dashboard',
    element: <AdminRoute><AdminDashboard /></AdminRoute>,
  },
  {
    path: '/admin-operations',
    element: <AdminRoute><AdminOperations /></AdminRoute>,
  },
  { path: '/admin-portal', element: <Navigate to="/admin-dashboard" replace /> },
  { path: '/admin', element: <Navigate to="/admin-dashboard" replace /> },

  { path: '/terms', element: <Terms /> },
  { path: '/privacy', element: <Privacy /> },
  { path: '/refund-policy', element: <RefundPolicy /> },
  { path: '/aml-policy', element: <AMLPolicy /> },
  { path: '*', element: <NotFound /> },
];

export default routes;
