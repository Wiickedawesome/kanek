import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { Icon } from '@/components/icons';
import { ScreenHeader, useFloatingTabBarPad } from '@/components/ui';
import { colors, type, spacing, borderRadius, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { useGetContractByIdQuery } from '@/store/api/bookingsApi';
import { useGetMessagesQuery, useSendMessageMutation } from '@/store/api/messagesApi';
import type { MessageWithSender } from '@/store/api/messagesApi';
import { useRealtime } from '@/hooks/useRealtime';
import { safeGoBack } from '@/lib/helpers';
import { showAlert } from '@/lib/alert';
import type { RootState } from '@/store';
import { Text } from '@/components/ui/Text';

const MESSAGING_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours

export default function MessagesScreen() {
  const { c } = useTheme();
  const styles = createStyles(c);
  const tabBarPad = useFloatingTabBarPad();
  const { contractId } = useLocalSearchParams<{ contractId: string }>();
  const authUser = useSelector((state: RootState) => state.auth.user);
  const userId = authUser?.id;

  const { data: contract } = useGetContractByIdQuery(contractId ?? '', {
    skip: !contractId,
  });
  const { data: messages = [] } = useGetMessagesQuery(contractId ?? '', {
    skip: !contractId,
  });
  const [sendMessage, { isLoading: isSending }] = useSendMessageMutation();
  const { subscribeToMessages } = useRealtime();

  // Disable messaging 24h after contract is completed or cancelled
  const messagingExpired = useMemo(() => {
    if (!contract) return false;
    const endedStatuses = ['completed', 'cancelled'];
    if (!endedStatuses.includes(contract.status)) return false;
    const endedAt = contract.completed_at ?? contract.created_at;
    return Date.now() - new Date(endedAt).getTime() > MESSAGING_GRACE_PERIOD_MS;
  }, [contract]);

  const [messageText, setMessageText] = useState('');
  const chatListRef = useRef<FlatList<MessageWithSender>>(null);

  // Subscribe to real-time chat messages
  useEffect(() => {
    if (!contractId) return;
    const unsubscribe = subscribeToMessages(contractId);
    return unsubscribe;
  }, [contractId, subscribeToMessages]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    if (!contractId || !userId || !messageText.trim()) return;
    try {
      await sendMessage({ contractId, senderId: userId, body: messageText }).unwrap();
      setMessageText('');
    } catch {
      showAlert('Error', 'Could not send message.');
    }
  }, [contractId, userId, messageText, sendMessage]);

  const renderMessage = ({ item }: { item: MessageWithSender }) => {
    const isMe = item.sender_id === userId;
    const senderName = item.sender
      ? `${item.sender.first_name ?? ''} ${item.sender.last_name ?? ''}`.trim()
      : 'Unknown';
    const time = new Date(item.created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.theirBubble]}>
        {!isMe && <Text style={styles.senderName}>{senderName}</Text>}
        <Text style={[styles.messageText, isMe && styles.myMessageText]}>{item.body}</Text>
        <Text style={[styles.messageTime, isMe && styles.myMessageTime]}>{time}</Text>
      </View>
    );
  };

  const title = contract?.post?.title ?? 'Messages';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <ScreenHeader style={styles.header}>
        <Pressable
          onPress={() => safeGoBack(`/(tabs)/activity/${contractId}`)}
          hitSlop={12}
        >
          <Icon name="chevron-left" size={24} color={c.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.headerRight} />
      </ScreenHeader>

      {/* Chat */}
      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={chatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.chatContent}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={7}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Icon name="message-circle" size={48} color={c.textMuted} />
              <Text style={styles.emptyChatText}>No messages yet</Text>
              <Text style={styles.emptyChatSubText}>
                Start a conversation with the other party
              </Text>
            </View>
          }
        />

        {/* Input bar */}
        {messagingExpired ? (
          <View style={[styles.expiredBar, { paddingBottom: spacing.md + tabBarPad }]}>
            <Icon name="lock" size={16} color={c.textMuted} />
            <Text style={styles.expiredText}>
              Messaging disabled — this job ended more than 24 hours ago
            </Text>
          </View>
        ) : (
          <View style={[styles.inputBar, { paddingBottom: spacing.sm + tabBarPad }]}>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message..."
              placeholderTextColor={c.textMuted}
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={500}
            />
            <Pressable
              style={[
                styles.sendButton,
                (!messageText.trim() || isSending) && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={!messageText.trim() || isSending}
            >
              <Icon
                name="send"
                size={18}
                color={
                  !messageText.trim() || isSending
                    ? colors.neutral[400]
                    : colors.neutral[0]
                }
              />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    ...type.h3.bold,
    color: c.text,
    flex: 1,
    textAlign: 'center',
  },
  headerRight: { width: 24 },

  chatContainer: { flex: 1 },
  chatContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  emptyChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  emptyChatText: { ...type.body.bold, color: c.textMuted },
  emptyChatSubText: { ...type.bodySm.regular, color: c.textMuted },

  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  myBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.accent.green,
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    alignSelf: 'flex-start',
    backgroundColor: c.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: c.border,
  },
  senderName: {
    ...type.caption.regular,
    color: c.textMuted,
    fontWeight: '600',
    marginBottom: 2,
  },
  messageText: { ...type.body.regular, color: c.text },
  myMessageText: { color: c.textInverse },
  messageTime: {
    ...type.caption.regular,
    color: c.textMuted,
    marginTop: 2,
    alignSelf: 'flex-end',
  },
  myMessageTime: { color: 'rgba(255,255,255,0.7)' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: c.border,
    backgroundColor: c.surface,
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    ...type.body.regular,
    color: c.text,
    backgroundColor: c.bg,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: c.border,
  },
  expiredBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: c.border,
    backgroundColor: c.bg,
  },
  expiredText: {
    ...type.caption.regular,
    color: c.textMuted,
    flexShrink: 1,
  },
});
