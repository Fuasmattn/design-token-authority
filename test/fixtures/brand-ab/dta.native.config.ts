// The brand-ab config with the native outputs only (snapshot scenario build-native, TICKET-011–013).
import config from './dta.config.ts'

export default {
  ...config,
  outputs: {
    ...config.outputs,
    formats: ['ios-swift', 'android-xml', 'android-compose'],
    android: { package: 'com.example.tokens' },
  },
}
