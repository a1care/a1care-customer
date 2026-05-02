import { registerRootComponent } from 'expo';
import { ExpoRoot } from 'expo-router';
import { QueryProvider } from './providers/QueryProvider';

// Must be exported or else Expo will fail
export function App() {
    const ctx = require.context('./app');
    return (
        <QueryProvider>
            <ExpoRoot context={ctx} />
        </QueryProvider>
    );
}

registerRootComponent(App);
