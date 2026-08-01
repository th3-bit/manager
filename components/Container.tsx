import { View, ViewProps } from 'react-native';

export function Container({ children, style, ...rest }: ViewProps) {
  return (
    <View className="flex-1 bg-white p-4" {...rest}>
      {children}
    </View>
  );
}
