# 🔔 Real-Time Notification System Guide

## Overview

This notification system provides real-time alerts with sound notifications for restaurant owners when new orders are placed. The system includes:

- **Sound Alerts**: Plays a notification sound when new orders arrive
- **Browser Notifications**: Shows desktop notifications (when permitted)
- **Visual Indicators**: Bell icon with badge showing new order count
- **Toggle Control**: Enable/disable notifications on demand
- **Polling System**: Checks for new orders every 10 seconds

---

## 📁 Files Created

### 1. **useOrderNotifications Hook**
**Location**: `afro-eats/src/hooks/useOrderNotifications.js`

Custom React hook that:
- Polls the backend for new orders every 10 seconds
- Plays notification sound when new orders detected
- Shows browser notifications
- Manages notification state (count, enabled/disabled)
- Requests browser notification permission

### 2. **NotificationBell Component**
**Location**: `afro-eats/src/components/NotificationBell.js`

Visual component that:
- Displays a bell icon in the header
- Shows badge with new order count
- Animates when new orders arrive
- Includes toggle button to enable/disable notifications
- Only visible to restaurant owners and admins

### 3. **Notification Sound File**
**Location**: `afro-eats/public/notification.mp3`

**⚠️ IMPORTANT**: You need to add your own sound file!

---

## 🎵 Adding Your Notification Sound

### Step 1: Get a Sound File

**Option A - Download Free Sound:**
1. Visit https://mixkit.co/free-sound-effects/notification/
2. Or visit https://freesound.org/ and search for "notification"
3. Download a short (1-3 second) notification sound
4. Recommended: "ding", "chime", or "bell" sounds

**Option B - Record Your Own:**
1. Use your phone's voice recorder
2. Record a short "ding" or notification sound
3. Transfer the file to your computer

**Option C - Use System Sounds:**
- macOS: `/System/Library/Sounds/` (copy any .aiff sound)
- Windows: `C:\Windows\Media\` (copy any .wav sound)

### Step 2: Convert to MP3 (if needed)

If your sound isn't MP3 format, convert it using:
- **Online**: https://online-audio-converter.com/
- **macOS**: Use iTunes/Music app
- **Windows**: Use VLC Media Player
- **Linux**: Use `ffmpeg -i input.wav output.mp3`

### Step 3: Add the File

1. Rename your file to exactly: `notification.mp3`
2. Copy it to: `afro-eats/public/notification.mp3`
3. Delete the placeholder file: `afro-eats/public/notification.mp3.txt`

**File Requirements:**
- **Format**: MP3 or WAV
- **Duration**: 1-3 seconds (keep it short!)
- **Volume**: Medium (not too loud or quiet)
- **Size**: Under 100KB recommended

---

## 🚀 How It Works

### For Restaurant Owners:

1. **Login** to your owner dashboard
2. **See the Bell Icon** in the top-right corner
3. **Allow Notifications** when prompted by the browser
4. **Receive Alerts** when customers place new orders:
   - 🔊 Hear a sound notification
   - 💻 See a desktop notification (if permitted)
   - 🔔 See the bell icon animate with a red badge
   - 📱 Badge shows count of new orders

### Notification Bell Features:

```
🔔  Bell Icon
  ├─ Shows badge with new order count
  ├─ Animates (bounces) when new orders arrive
  └─ Click to clear the count

🔕/🔔 Toggle Button
  ├─ Green = Notifications enabled
  └─ Gray = Notifications disabled
```

---

## 🔧 Technical Details

### Polling Strategy

The system checks for new orders every **10 seconds**:

```javascript
// Checks for orders created in the last 30 seconds
const isNewOrder = (Date.now() - orderTime) < 30000;
```

**Why Polling?**
- Simple to implement
- No WebSocket server needed
- Works with any backend
- Low server load (10-second intervals)

### Detection Logic

1. Fetches latest orders every 10 seconds
2. Compares latest order ID with previous check
3. If new order ID detected AND order is less than 30 seconds old:
   - Play sound
   - Show browser notification
   - Update badge count
   - Animate bell icon

### Browser Notification Permission

The system requests notification permission automatically, but users can:
- Grant permission (recommended for best experience)
- Deny permission (sound still plays)
- Revoke permission later in browser settings

---

## 🎨 Customization

### Change Polling Interval

Edit `afro-eats/src/hooks/useOrderNotifications.js`:

```javascript
// Change 10000 (10 seconds) to your preferred interval
pollingIntervalRef.current = setInterval(checkForNewOrders, 10000);
```

### Change Sound Volume

Edit `afro-eats/src/hooks/useOrderNotifications.js`:

```javascript
// Change 0.7 (70%) to your preferred volume (0.0 to 1.0)
audioRef.current.volume = 0.7;
```

### Change Notification Title/Body

Edit `afro-eats/src/hooks/useOrderNotifications.js`:

```javascript
showBrowserNotification(
  '🍽️ New Order Received!',  // Change title here
  `Order #${latestOrder.id} - $${Number(latestOrder.total || 0).toFixed(2)}`  // Change body here
);
```

### Change Bell Icon Appearance

Edit `afro-eats/src/components/NotificationBell.js`:

```javascript
// Change colors, sizes, animations in the className strings
className="w-6 h-6 text-orange-600 animate-bounce"
```

---

## 🐛 Troubleshooting

### Sound Not Playing

**Problem**: No sound when new order arrives

**Solutions**:
1. ✅ Check that `notification.mp3` exists in `afro-eats/public/`
2. ✅ Ensure notifications are enabled (toggle button is green)
3. ✅ Check browser console for audio errors
4. ✅ Try clicking anywhere on the page first (browsers block autoplay until user interaction)
5. ✅ Check computer volume is not muted
6. ✅ Try a different browser (Chrome/Firefox recommended)

### Browser Notifications Not Showing

**Problem**: No desktop notification popup

**Solutions**:
1. ✅ Click "Allow" when browser asks for notification permission
2. ✅ Check browser notification settings:
   - **Chrome**: Settings → Privacy → Site Settings → Notifications
   - **Firefox**: Settings → Privacy → Permissions → Notifications
   - **Safari**: Preferences → Websites → Notifications
3. ✅ Ensure "Do Not Disturb" is off on your OS
4. ✅ Check that notifications are enabled in OS settings:
   - **macOS**: System Preferences → Notifications
   - **Windows**: Settings → System → Notifications

### Bell Icon Not Updating

**Problem**: Bell shows no new orders even though orders exist

**Solutions**:
1. ✅ Check browser console for errors
2. ✅ Verify restaurant ID is correct
3. ✅ Check network tab for API calls (should see requests every 10 seconds)
4. ✅ Refresh the page
5. ✅ Check that you're logged in as a restaurant owner

### Notifications Delayed

**Problem**: Notifications arrive late

**Solutions**:
1. ✅ System checks every 10 seconds - this is normal
2. ✅ To make faster, reduce polling interval (see Customization section)
3. ✅ Check internet connection stability
4. ✅ Check server response time

---

## 🔐 Security & Privacy

- **No Personal Data Stored**: Only order IDs and counts are tracked
- **Local Storage**: Notification preferences stored in browser only
- **Secure API Calls**: All requests use credentials and authentication
- **Permission-Based**: Requires user consent for browser notifications
- **No External Services**: All notifications handled in-house

---

## 🚧 Future Enhancements

Possible improvements for the future:

1. **WebSocket Integration**: Real-time updates without polling
2. **Custom Notification Sounds**: Upload your own sounds via dashboard
3. **Notification History**: View past notifications
4. **Notification Preferences**: Choose which events trigger notifications
5. **Mobile Push Notifications**: Native mobile app notifications
6. **Email Notifications**: Send email alerts for new orders
7. **SMS Notifications**: Send text message alerts
8. **Multi-Language Support**: Notification messages in different languages
9. **Sound Library**: Choose from multiple built-in sounds
10. **Notification Scheduling**: Quiet hours/do-not-disturb times

---

## 📞 Support

If you encounter issues:

1. Check this guide's Troubleshooting section
2. Check browser console for error messages
3. Verify all files are in correct locations
4. Ensure notification sound file is properly formatted
5. Test in a different browser
6. Clear browser cache and reload

---

## ✅ Testing Checklist

Before going live, test:

- [ ] Notification sound plays when new order arrives
- [ ] Bell icon updates with correct count
- [ ] Browser notifications appear (if permitted)
- [ ] Bell animates (bounces) when new orders arrive
- [ ] Toggle button enables/disables notifications
- [ ] Clicking bell clears the count
- [ ] Works on Chrome browser
- [ ] Works on Firefox browser
- [ ] Works on Safari browser
- [ ] Works on mobile devices
- [ ] Sound volume is appropriate
- [ ] Notifications don't cause performance issues
- [ ] Multiple new orders are counted correctly

---

## 📝 Change Log

**Version 1.0** - Initial Release
- Polling-based notification system
- Sound alerts
- Browser notifications
- Visual bell icon with badge
- Toggle to enable/disable
- Support for restaurant owners

---

Made with ❤️ for Afro-Eats Platform
