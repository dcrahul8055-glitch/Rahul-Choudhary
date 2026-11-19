import JSZip from 'jszip';
import { C2WakeConfig, GeneratedProjectFile } from '../types/config';

function formatKeyLabel(key: C2WakeConfig['wakeKey']): string {
  switch (key) {
    case 'VOL_UP':
      return 'Volume Up';
    case 'VOL_DOWN':
      return 'Volume Down';
    case 'EITHER':
      return 'Volume Up or Down';
  }
}

function formatWakeGestureLabel(gesture: C2WakeConfig['wakeGesture']): string {
  switch (gesture) {
    case 'SINGLE_CLICK':
      return 'Single Click';
    case 'DOUBLE_CLICK':
      return 'Double Click';
    case 'LONG_PRESS':
      return 'Long Press';
  }
}

function formatLockGestureLabel(gesture: C2WakeConfig['lockGesture']): string {
  switch (gesture) {
    case 'DOUBLE_CLICK':
      return 'Double Click';
    case 'LONG_PRESS':
      return 'Long Press';
    case 'CHORD':
      return 'Volume Up + Down Chord';
    case 'DISABLED':
      return 'Disabled (Notification / Tile Only)';
  }
}

export function generateAndroidProject(config: C2WakeConfig): GeneratedProjectFile[] {
  const pkgPath = config.packageName.replace(/\./g, '/');
  const safeAppName = config.appName.trim() || 'C2 Wake';

  const manifestXml = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Required to keep hardware volume clicks active and turn the screen ON -->
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
    <uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />
    ${config.hapticFeedback ? '<uses-permission android:name="android.permission.VIBRATE" />' : '<!-- VIBRATE disabled in configuration -->'}
    ${config.startOnBoot ? '<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />' : '<!-- RECEIVE_BOOT_COMPLETED disabled in configuration -->'}

    <application
        android:allowBackup="true"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:theme="@style/Theme.AppCompat.Light.DarkActionBar">

        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Transparent activity using Android 8.1-15 setTurnScreenOn(true) for reliable wakeup -->
        <activity
            android:name=".WakeHelperActivity"
            android:excludeFromRecents="true"
            android:exported="false"
            android:launchMode="singleInstance"
            android:noHistory="true"
            android:showOnLockScreen="true"
            android:taskAffinity=""
            android:theme="@android:style/Theme.Translucent.NoTitleBar"
            android:turnScreenOn="true" />

        <!-- Intercepts hardware Volume keys and locks the screen via Android 9+ Global Action -->
        <service
            android:name=".VolumeKeyAccessibilityService"
            android:exported="false"
            android:label="@string/accessibility_service_label"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService" />
            </intent-filter>
            <meta-data
                android:name="android.accessibilityservice"
                android:resource="@xml/accessibility_service_config" />
        </service>

        <!-- Keeps Volume button wake listener alive while screen is off -->
        <service
            android:name=".ScreenWakeForegroundService"
            android:exported="false"
            android:foregroundServiceType="mediaPlayback" />
${
  config.startOnBoot
    ? `
        <receiver
            android:name=".BootCompletedReceiver"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.LOCKED_BOOT_COMPLETED" />
            </intent-filter>
        </receiver>`
    : ''
}
    </application>
</manifest>
`;

  const accessibilityConfigXml = `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeWindowStateChanged"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:accessibilityFlags="flagRequestFilterKeyEvents"
    android:canRequestFilterKeyEvents="true"
    android:description="@string/accessibility_service_description"
    android:notificationTimeout="100" />
`;

  const stringsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${safeAppName}</string>
    <string name="accessibility_service_label">${safeAppName} Volume Controller</string>
    <string name="accessibility_service_description">Intercepts Volume Up and Volume Down button presses to turn the screen on and lock the screen without using the physical power button.</string>
</resources>
`;

  const wakeConfigKt = `package ${config.packageName}

/**
 * Generated configuration for Realme C2 (Android 9) & Realme 12x 5G RMX3998 (Android 14).
 * Exported from C2 Wake Studio.
 */
object WakeConfig {
    const val WAKE_KEY = "${config.wakeKey}"           // VOL_UP | VOL_DOWN | EITHER
    const val WAKE_GESTURE = "${config.wakeGesture}"   // SINGLE_CLICK | DOUBLE_CLICK | LONG_PRESS
    const val LOCK_KEY = "${config.lockKey}"           // VOL_UP | VOL_DOWN | EITHER
    const val LOCK_GESTURE = "${config.lockGesture}"   // DOUBLE_CLICK | LONG_PRESS | CHORD | DISABLED

    const val DOUBLE_CLICK_WINDOW_MS = ${config.doubleClickWindowMs}L
    const val LONG_PRESS_DURATION_MS = ${config.longPressDurationMs}L

    const val POCKET_PROTECTION = ${config.pocketProtection}
    const val MEDIA_SAFEGUARD = ${config.mediaSafeguard}
    const val HAPTIC_FEEDBACK = ${config.hapticFeedback}
    const val PERSISTENT_NOTIFICATION_LOCK = ${config.persistentNotificationLock}
    const val WAKE_ENGINE = "${config.wakeEngine}"     // MEDIA_SESSION | WAKELOCK_ACCESSIBILITY

    const val ACTION_LOCK_SCREEN_NOW = "${config.packageName}.ACTION_LOCK_SCREEN_NOW"
    const val ACTION_STATUS_UPDATED = "${config.packageName}.ACTION_STATUS_UPDATED"
}
`;

  const wakeManagerKt = `package ${config.packageName}

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator

/**
 * Shared runtime state & reliable display wake helper across Android 8.1 through Android 15.
 * Fixes two common Android wakeup failures:
 *  1. Never immediately releases the WakeLock after acquire() (holds for 4s timeout).
 *  2. Launches WakeHelperActivity with setTurnScreenOn(true) for Android 10-15 compatibility.
 */
object WakeManager {
    @Volatile
    var isForegroundServiceRunning: Boolean = false

    @Volatile
    var isAccessibilityConnected: Boolean = false

    @Volatile
    var lastEventSummary: String = "No volume presses detected yet"

    @Volatile
    private var lastWakeTimestampMs: Long = 0L

    fun recordEvent(context: Context, message: String) {
        lastEventSummary = message
        try {
            context.sendBroadcast(
                Intent(WakeConfig.ACTION_STATUS_UPDATED).setPackage(context.packageName)
            )
        } catch (_: Exception) {
        }
    }

    @Suppress("DEPRECATION")
    fun wakeScreen(context: Context, source: String) {
        val now = SystemClock.elapsedRealtime()
        if (now - lastWakeTimestampMs < 400L) return
        lastWakeTimestampMs = now

        val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager

        // 1. Acquire WakeLock with timeout (DO NOT call release() immediately!)
        try {
            val wakeLock = powerManager.newWakeLock(
                PowerManager.FULL_WAKE_LOCK or
                    PowerManager.ACQUIRE_CAUSES_WAKEUP or
                    PowerManager.ON_AFTER_RELEASE,
                "${config.packageName}:DisplayWake"
            )
            wakeLock.acquire(4000L)
        } catch (_: Exception) {
            try {
                val fallbackLock = powerManager.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK or
                        PowerManager.ACQUIRE_CAUSES_WAKEUP or
                        PowerManager.ON_AFTER_RELEASE,
                    "${config.packageName}:DisplayWakeFallback"
                )
                fallbackLock.acquire(4000L)
            } catch (_: Exception) {
            }
        }

        // 2. Launch transparent WakeHelperActivity using official setTurnScreenOn(true) API
        try {
            val wakeIntent = Intent(context, WakeHelperActivity::class.java).apply {
                addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_NO_ANIMATION or
                        Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS
                )
            }
            context.startActivity(wakeIntent)
        } catch (_: Exception) {
        }

        triggerHaptic(context)
        recordEvent(context, "Woke screen via $source")
    }

    fun triggerHaptic(context: Context) {
        if (!WakeConfig.HAPTIC_FEEDBACK) return
        val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator ?: return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createOneShot(30, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(30)
            }
        } catch (_: Exception) {
        }
    }
}
`;

  const wakeHelperActivityKt = `package ${config.packageName}

import android.app.Activity
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.WindowManager

/**
 * Transparent 0-UI helper activity that wakes the display reliably on Android 9 through Android 15
 * using setTurnScreenOn(true) + setShowWhenLocked(true), then immediately closes itself.
 */
class WakeHelperActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }

        @Suppress("DEPRECATION")
        window.addFlags(
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        )

        Handler(Looper.getMainLooper()).postDelayed({
            finish()
            @Suppress("DEPRECATION")
            overridePendingTransition(0, 0)
        }, 450L)
    }
}
`;

  const accessibilityServiceKt = `package ${config.packageName}

import android.accessibilityservice.AccessibilityService
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent

class VolumeKeyAccessibilityService : AccessibilityService(), SensorEventListener {

    private var powerManager: PowerManager? = null
    private var audioManager: AudioManager? = null
    private var sensorManager: SensorManager? = null
    private var proximitySensor: Sensor? = null

    private val handler = Handler(Looper.getMainLooper())
    private var isNearPocket = false

    private var lastClickKey = -1
    private var lastClickTimeMs = 0L
    private var volUpPressed = false
    private var volDownPressed = false
    private var longPressTriggered = false

    private val longPressRunnable = Runnable {
        longPressTriggered = true
        val screenOn = powerManager?.isInteractive ?: true
        if (!screenOn && WakeConfig.WAKE_GESTURE == "LONG_PRESS") {
            wakeIfNotInPocket("Accessibility Long Press")
        } else if (screenOn && WakeConfig.LOCK_GESTURE == "LONG_PRESS") {
            lockScreenNow("Volume Long Press")
        }
    }

    private val lockActionReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == WakeConfig.ACTION_LOCK_SCREEN_NOW) {
                lockScreenNow("Notification / Button")
            }
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        WakeManager.isAccessibilityConnected = true

        if (WakeConfig.POCKET_PROTECTION) {
            sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
            proximitySensor = sensorManager?.getDefaultSensor(Sensor.TYPE_PROXIMITY)
            proximitySensor?.let {
                sensorManager?.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL)
            }
        }

        val filter = IntentFilter(WakeConfig.ACTION_LOCK_SCREEN_NOW)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(lockActionReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            registerReceiver(lockActionReceiver, filter)
        }

        WakeManager.recordEvent(this, "Accessibility service connected")
    }

    override fun onKeyEvent(event: KeyEvent): Boolean {
        val code = event.keyCode
        if (code != KeyEvent.KEYCODE_VOLUME_UP && code != KeyEvent.KEYCODE_VOLUME_DOWN) {
            return super.onKeyEvent(event)
        }

        val pm = powerManager ?: (getSystemService(Context.POWER_SERVICE) as PowerManager).also {
            powerManager = it
        }
        val screenOn = pm.isInteractive
        val keyName = if (code == KeyEvent.KEYCODE_VOLUME_UP) "Vol+" else "Vol-"

        if (event.action == KeyEvent.ACTION_DOWN) {
            if (code == KeyEvent.KEYCODE_VOLUME_UP) volUpPressed = true
            if (code == KeyEvent.KEYCODE_VOLUME_DOWN) volDownPressed = true

            if (screenOn && WakeConfig.LOCK_GESTURE == "CHORD" && volUpPressed && volDownPressed) {
                handler.removeCallbacks(longPressRunnable)
                longPressTriggered = true
                lockScreenNow("Vol+ & Vol- Chord")
                return true
            }

            if (screenOn && WakeConfig.MEDIA_SAFEGUARD && isAudioOrCallActive()) {
                return false
            }

            if (event.repeatCount == 0) {
                longPressTriggered = false
                val shouldWatchLongPress =
                    (!screenOn && WakeConfig.WAKE_GESTURE == "LONG_PRESS" && matchesKey(code, WakeConfig.WAKE_KEY)) ||
                    (screenOn && WakeConfig.LOCK_GESTURE == "LONG_PRESS" && matchesKey(code, WakeConfig.LOCK_KEY))

                if (shouldWatchLongPress) {
                    handler.postDelayed(longPressRunnable, WakeConfig.LONG_PRESS_DURATION_MS)
                }
            }

            return !screenOn && matchesKey(code, WakeConfig.WAKE_KEY)
        }

        if (event.action == KeyEvent.ACTION_UP) {
            if (code == KeyEvent.KEYCODE_VOLUME_UP) volUpPressed = false
            if (code == KeyEvent.KEYCODE_VOLUME_DOWN) volDownPressed = false
            handler.removeCallbacks(longPressRunnable)

            if (longPressTriggered) {
                longPressTriggered = false
                return true
            }

            val now = SystemClock.elapsedRealtime()
            val delta = now - lastClickTimeMs
            val isDoubleClick = (code == lastClickKey) && (delta in 1..WakeConfig.DOUBLE_CLICK_WINDOW_MS)

            if (!screenOn && matchesKey(code, WakeConfig.WAKE_KEY)) {
                if (WakeConfig.WAKE_GESTURE == "SINGLE_CLICK") {
                    lastClickTimeMs = 0L
                    wakeIfNotInPocket("$keyName Single Click")
                    return true
                }
                if (WakeConfig.WAKE_GESTURE == "DOUBLE_CLICK") {
                    if (isDoubleClick) {
                        lastClickTimeMs = 0L
                        wakeIfNotInPocket("$keyName Double Click (\${delta}ms)")
                        return true
                    } else {
                        lastClickKey = code
                        lastClickTimeMs = now
                        WakeManager.recordEvent(this, "$keyName click 1/2 (screen off)")
                        return true
                    }
                }
            }

            if (screenOn && WakeConfig.LOCK_GESTURE == "DOUBLE_CLICK" && matchesKey(code, WakeConfig.LOCK_KEY)) {
                if (WakeConfig.MEDIA_SAFEGUARD && isAudioOrCallActive()) {
                    return false
                }
                if (isDoubleClick) {
                    lastClickTimeMs = 0L
                    lockScreenNow("$keyName Double Click (\${delta}ms)")
                    return true
                }
            }

            lastClickKey = code
            lastClickTimeMs = now
            WakeManager.recordEvent(this, "$keyName pressed (screen \${if (screenOn) "ON" else "OFF"})")
        }

        return super.onKeyEvent(event)
    }

    private fun matchesKey(keyCode: Int, target: String): Boolean {
        return when (target) {
            "VOL_UP" -> keyCode == KeyEvent.KEYCODE_VOLUME_UP
            "VOL_DOWN" -> keyCode == KeyEvent.KEYCODE_VOLUME_DOWN
            else -> keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN
        }
    }

    private fun isAudioOrCallActive(): Boolean {
        val am = audioManager ?: return false
        val mode = am.mode
        val inCall = mode == AudioManager.MODE_IN_CALL ||
            mode == AudioManager.MODE_IN_COMMUNICATION ||
            mode == AudioManager.MODE_RINGTONE
        return am.isMusicActive || inCall
    }

    private fun wakeIfNotInPocket(source: String) {
        if (WakeConfig.POCKET_PROTECTION && isNearPocket) {
            WakeManager.recordEvent(this, "Wake blocked by proximity sensor")
            return
        }
        WakeManager.wakeScreen(this, source)
    }

    private fun lockScreenNow(source: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val ok = performGlobalAction(GLOBAL_ACTION_LOCK_SCREEN)
            WakeManager.triggerHaptic(this)
            WakeManager.recordEvent(
                this,
                if (ok) "Locked screen via $source" else "Lock action rejected by system"
            )
        }
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event?.sensor?.type == Sensor.TYPE_PROXIMITY) {
            val maxRange = event.sensor.maximumRange
            isNearPocket = event.values[0] < maxRange && event.values[0] < 3.0f
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
    override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit
    override fun onInterrupt() = Unit

    override fun onDestroy() {
        super.onDestroy()
        WakeManager.isAccessibilityConnected = false
        sensorManager?.unregisterListener(this)
        try {
            unregisterReceiver(lockActionReceiver)
        } catch (_: Exception) {
        }
    }
}
`;

  const foregroundServiceKt = `package ${config.packageName}

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.os.SystemClock
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.media.VolumeProviderCompat

/**
 * Keeps hardware Volume button detection alive while the screen is OFF.
 *
 * Uses TWO coordinated mechanisms so screen-off volume presses work reliably across
 * Android 9 (Realme C2) through Android 14 (Realme 12x 5G RMX3998):
 *  1. Holds a PARTIAL_WAKE_LOCK so the CPU never drops Volume key hardware interrupts.
 *  2. Primes a MediaSessionCompat with a brief silent AudioTrack pulse + VolumeProviderCompat
 *     so Android routes screen-off volume events even on OEMs that suppress Accessibility keys.
 */
class ScreenWakeForegroundService : Service(), SensorEventListener {

    private lateinit var powerManager: PowerManager
    private var mediaSession: MediaSessionCompat? = null
    private var partialWakeLock: PowerManager.WakeLock? = null
    private var sensorManager: SensorManager? = null
    private var isNearPocket = false

    private var lastDirection = 0
    private var lastPressMs = 0L

    override fun onCreate() {
        super.onCreate()
        powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        createNotificationChannel()

        val fgType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
        } else {
            0
        }
        ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(), fgType)
        WakeManager.isForegroundServiceRunning = true

        if (WakeConfig.POCKET_PROTECTION) {
            sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
            sensorManager?.getDefaultSensor(Sensor.TYPE_PROXIMITY)?.let {
                sensorManager?.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL)
            }
        }

        // Always keep a lightweight CPU partial wake lock so screen-off volume buttons fire
        acquireCpuWakeLock()

        if (WakeConfig.WAKE_ENGINE == "MEDIA_SESSION") {
            primeSilentAudioForMediaSession()
            initMediaSessionVolumeIntercept()
        }

        WakeManager.recordEvent(this, "Screen-Off Wake Service started")
    }

    private fun acquireCpuWakeLock() {
        try {
            partialWakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "${config.packageName}:KeepVolumeKeysAlive"
            ).apply {
                setReferenceCounted(false)
                acquire()
            }
        } catch (_: Exception) {
        }
    }

    /**
     * Android 8+ ignores MediaSession volume routing until the app has played at least one
     * audio buffer. Writing 40ms of 0-amplitude silence activates routing silently.
     */
    private fun primeSilentAudioForMediaSession() {
        Thread {
            try {
                val sampleRate = 8000
                val bufferSize = AudioTrack.getMinBufferSize(
                    sampleRate,
                    AudioFormat.CHANNEL_OUT_MONO,
                    AudioFormat.ENCODING_PCM_16BIT
                ).coerceAtLeast(640)

                val track = AudioTrack.Builder()
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                            .build()
                    )
                    .setAudioFormat(
                        AudioFormat.Builder()
                            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                            .setSampleRate(sampleRate)
                            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                            .build()
                    )
                    .setBufferSizeInBytes(bufferSize)
                    .setTransferMode(AudioTrack.MODE_STATIC)
                    .build()

                val silence = ByteArray(bufferSize)
                track.write(silence, 0, silence.size)
                track.play()
                Thread.sleep(60)
                track.stop()
                track.release()
            } catch (_: Exception) {
            }
        }.start()
    }

    private fun initMediaSessionVolumeIntercept() {
        val session = MediaSessionCompat(this, "C2WakeVolumeSession")
        session.setCallback(object : MediaSessionCompat.Callback() {})
        session.setPlaybackState(
            PlaybackStateCompat.Builder()
                .setActions(PlaybackStateCompat.ACTION_PLAY or PlaybackStateCompat.ACTION_PAUSE)
                .setState(PlaybackStateCompat.STATE_PLAYING, 0L, 1f)
                .build()
        )

        val volumeProvider = object : VolumeProviderCompat(VOLUME_CONTROL_RELATIVE, 100, 50) {
            override fun onAdjustVolume(direction: Int) {
                // Keep virtual level centered at 50 so Android never clamps out repeated presses
                currentVolume = 50
                if (direction == 0 || powerManager.isInteractive) return
                handleScreenOffVolumeStep(direction)
            }
        }

        session.setPlaybackToRemote(volumeProvider)
        session.isActive = true
        mediaSession = session
    }

    private fun handleScreenOffVolumeStep(direction: Int) {
        val isUp = direction > 0
        val matchesTarget = when (WakeConfig.WAKE_KEY) {
            "VOL_UP" -> isUp
            "VOL_DOWN" -> !isUp
            else -> true
        }
        if (!matchesTarget) return

        val keyName = if (isUp) "Vol+" else "Vol-"
        val now = SystemClock.elapsedRealtime()
        val delta = now - lastPressMs
        val isDouble = (direction == lastDirection) && (delta in 1..WakeConfig.DOUBLE_CLICK_WINDOW_MS)

        if (WakeConfig.WAKE_GESTURE == "SINGLE_CLICK") {
            wakeIfAllowed("$keyName MediaSession Single")
            lastPressMs = 0L
            return
        }

        if (WakeConfig.WAKE_GESTURE == "DOUBLE_CLICK" && isDouble) {
            lastPressMs = 0L
            wakeIfAllowed("$keyName MediaSession Double (\${delta}ms)")
            return
        }

        lastDirection = direction
        lastPressMs = now
        WakeManager.recordEvent(this, "$keyName step 1/2 via MediaSession")
    }

    private fun wakeIfAllowed(source: String) {
        if (WakeConfig.POCKET_PROTECTION && isNearPocket) {
            WakeManager.recordEvent(this, "Wake blocked by proximity sensor")
            return
        }
        WakeManager.wakeScreen(this, source)
    }

    private fun buildNotification(): Notification {
        val openAppIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("${safeAppName} Running")
            .setContentText("Wake: ${formatWakeGestureLabel(config.wakeGesture)} (${formatKeyLabel(config.wakeKey)})")
            .setSmallIcon(android.R.drawable.ic_lock_power_off)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(openAppIntent)

        if (WakeConfig.PERSISTENT_NOTIFICATION_LOCK) {
            val lockIntent = PendingIntent.getBroadcast(
                this,
                1,
                Intent(WakeConfig.ACTION_LOCK_SCREEN_NOW).setPackage(packageName),
                PendingIntent.FLAG_IMMUTABLE
            )
            builder.addAction(android.R.drawable.ic_lock_lock, "Lock Screen Now", lockIntent)
        }

        return builder.build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "${safeAppName} Background Service",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        WakeManager.isForegroundServiceRunning = false
        mediaSession?.isActive = false
        mediaSession?.release()
        partialWakeLock?.let { if (it.isHeld) it.release() }
        sensorManager?.unregisterListener(this)
        WakeManager.recordEvent(this, "Screen-Off Wake Service stopped")
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event?.sensor?.type == Sensor.TYPE_PROXIMITY) {
            isNearPocket = event.values[0] < event.sensor.maximumRange && event.values[0] < 3.0f
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        private const val CHANNEL_ID = "c2_wake_service_channel"
        private const val NOTIFICATION_ID = 1941
    }
}
`;

  const mainActivityKt = `package ${config.packageName}

import android.Manifest
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    private lateinit var statusView: TextView
    private lateinit var lastEventView: TextView
    private val handler = Handler(Looper.getMainLooper())

    private val statusReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            refreshStatus()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val scroll = ScrollView(this)
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 56, 48, 64)
        }

        val title = TextView(this).apply {
            text = "${safeAppName} — Volume Screen Controller"
            textSize = 20f
            setTextColor(Color.parseColor("#0F172A"))
            setPadding(0, 0, 0, 12)
        }

        val configInfo = TextView(this).apply {
            text = """
                Wake Screen ON: ${formatWakeGestureLabel(config.wakeGesture)} (${formatKeyLabel(config.wakeKey)})
                Lock Screen OFF: ${formatLockGestureLabel(config.lockGesture)} (${formatKeyLabel(config.lockKey)})
                Double-Click Window: ${config.doubleClickWindowMs} ms
            """.trimIndent()
            textSize = 13f
            setTextColor(Color.parseColor("#475569"))
            setPadding(0, 0, 0, 24)
        }

        statusView = TextView(this).apply {
            textSize = 13f
            setTextColor(Color.parseColor("#0F172A"))
            setBackgroundColor(Color.parseColor("#F1F5F9"))
            setPadding(28, 24, 28, 24)
        }

        lastEventView = TextView(this).apply {
            textSize = 12f
            setTextColor(Color.parseColor("#92400E"))
            setPadding(0, 16, 0, 28)
        }

        val startServiceBtn = Button(this).apply {
            text = "1. Start Screen-Off Wake Service"
            setOnClickListener {
                ensureNotificationPermission()
                try {
                    val intent = Intent(this@MainActivity, ScreenWakeForegroundService::class.java)
                    ContextCompat.startForegroundService(this@MainActivity, intent)
                    Toast.makeText(this@MainActivity, "Wake Service started", Toast.LENGTH_SHORT).show()
                } catch (e: Exception) {
                    Toast.makeText(this@MainActivity, "Failed: \${e.message}", Toast.LENGTH_LONG).show()
                }
                handler.postDelayed({ refreshStatus() }, 300L)
            }
        }

        val appInfoBtn = Button(this).apply {
            text = "2. Android 13/14: Allow Restricted Settings (3-dot menu)"
            setOnClickListener {
                val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.parse("package:$packageName")
                }
                startActivity(intent)
                Toast.makeText(
                    this@MainActivity,
                    "Tap top-right 3 dots -> Allow restricted settings (if shown)",
                    Toast.LENGTH_LONG
                ).show()
            }
        }

        val accessibilityBtn = Button(this).apply {
            text = "3. Enable Accessibility Service (Required)"
            setOnClickListener {
                startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
            }
        }

        val batteryBtn = Button(this).apply {
            text = "4. Allow Background Running (Battery)"
            setOnClickListener {
                val pm = getSystemService(POWER_SERVICE) as PowerManager
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !pm.isIgnoringBatteryOptimizations(packageName)) {
                    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                        data = Uri.parse("package:$packageName")
                    }
                    startActivity(intent)
                } else {
                    startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
                }
            }
        }

        val testLockBtn = Button(this).apply {
            text = "Test A: Lock Screen Now"
            setOnClickListener {
                if (!isAccessibilityServiceEnabled()) {
                    Toast.makeText(
                        this@MainActivity,
                        "Enable Accessibility Service (Step 3) first!",
                        Toast.LENGTH_LONG
                    ).show()
                    return@setOnClickListener
                }
                sendBroadcast(Intent(WakeConfig.ACTION_LOCK_SCREEN_NOW).setPackage(packageName))
            }
        }

        val testAutoWakeBtn = Button(this).apply {
            text = "Test B: Lock Now & Auto-Wake in 5 Seconds"
            setOnClickListener {
                if (!isAccessibilityServiceEnabled()) {
                    Toast.makeText(
                        this@MainActivity,
                        "Enable Accessibility Service (Step 3) first!",
                        Toast.LENGTH_LONG
                    ).show()
                    return@setOnClickListener
                }
                Toast.makeText(this@MainActivity, "Locking now — screen will wake in 5s", Toast.LENGTH_SHORT).show()
                sendBroadcast(Intent(WakeConfig.ACTION_LOCK_SCREEN_NOW).setPackage(packageName))
                handler.postDelayed({
                    WakeManager.wakeScreen(applicationContext, "5s Self-Test")
                }, 5000L)
            }
        }

        container.addView(title)
        container.addView(configInfo)
        container.addView(statusView)
        container.addView(lastEventView)
        container.addView(startServiceBtn)
        container.addView(appInfoBtn)
        container.addView(accessibilityBtn)
        container.addView(batteryBtn)
        container.addView(testLockBtn)
        container.addView(testAutoWakeBtn)

        scroll.addView(container)
        setContentView(scroll)

        ensureNotificationPermission()
    }

    override fun onResume() {
        super.onResume()
        val filter = IntentFilter(WakeConfig.ACTION_STATUS_UPDATED)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(statusReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            registerReceiver(statusReceiver, filter)
        }
        refreshStatus()
    }

    override fun onPause() {
        super.onPause()
        try {
            unregisterReceiver(statusReceiver)
        } catch (_: Exception) {
        }
    }

    private fun ensureNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                ActivityCompat.requestPermissions(
                    this,
                    arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                    1001
                )
            }
        }
    }

    private fun isAccessibilityServiceEnabled(): Boolean {
        val am = getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
        val enabled = am.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
        return enabled.any { it.resolveInfo?.serviceInfo?.packageName == packageName }
    }

    private fun refreshStatus() {
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        val batteryOk = Build.VERSION.SDK_INT < Build.VERSION_CODES.M || pm.isIgnoringBatteryOptimizations(packageName)
        val a11yOk = isAccessibilityServiceEnabled()
        val fgOk = WakeManager.isForegroundServiceRunning

        statusView.text = """
            LIVE DIAGNOSTIC STATUS
            • Wake Foreground Service: \${if (fgOk) "RUNNING" else "STOPPED (Tap Step 1)"}
            • Accessibility Key Filter: \${if (a11yOk) "ENABLED" else "OFF (Tap Step 2 then Step 3)"}
            • Battery Optimization: \${if (batteryOk) "UNRESTRICTED" else "RESTRICTED (Tap Step 4)"}
        """.trimIndent()

        lastEventView.text = "Last Event: \${WakeManager.lastEventSummary}"
    }
}
`;

  const bootReceiverKt = `package ${config.packageName}

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

class BootCompletedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == Intent.ACTION_LOCKED_BOOT_COMPLETED) {
            try {
                val serviceIntent = Intent(context, ScreenWakeForegroundService::class.java)
                ContextCompat.startForegroundService(context, serviceIntent)
            } catch (_: Exception) {
                // Android 14+ may restrict background FGS launch on boot until app is opened once
            }
        }
    }
}
`;

  const appBuildGradle = `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "${config.packageName}"
    compileSdk = 34

    defaultConfig {
        applicationId = "${config.packageName}"
        minSdk = 26 // Supports Android 8.0 through Android 15 (Realme C2 & RMX3998)
        targetSdk = 34
        versionCode = 2
        versionName = "1.1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("androidx.media:media:1.7.0")
}
`;

  const rootBuildGradle = `plugins {
    id("com.android.application") version "8.2.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.22" apply false
}
`;

  const settingsGradle = `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "C2Wake"
include(":app")
`;

  const gradleProperties = `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
kotlin.code.style=official
android.nonTransitiveRClass=true
`;

  const githubWorkflowYml = `name: Build Realme APK

on:
  push:
    branches: [ "main", "master" ]
  workflow_dispatch:

jobs:
  build-apk:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout project
        uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: "17"
          distribution: "temurin"

      - name: Set up Gradle
        uses: gradle/actions/setup-gradle@v3
        with:
          gradle-version: "8.5"

      - name: Build Debug APK
        run: gradle assembleDebug

      - name: Upload Realme APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: C2Wake-Realme-APK
          path: app/build/outputs/apk/debug/app-debug.apk
`;

  const readmeMd = `# ${safeAppName} — Volume Screen Controller (v1.1.0)

Supports **Realme C2 (Android 9 / ColorOS 6)** and **Realme 12x 5G RMX3998 (Android 14 / realme UI 5.0)**.

## Key Fixes Included in v1.1.0
- Fixed immediate \`WakeLock.release()\` bug that prevented the screen from lighting up.
- Added \`WakeHelperActivity\` using Android 8.1–15's official \`setTurnScreenOn(true)\` API.
- Added silent \`AudioTrack\` prime + \`PARTIAL_WAKE_LOCK\` so Volume presses fire even when the screen is off.
- Added live status readout, **Allow Restricted Settings** shortcut (for Android 13/14 sideloaded APKs), and a **5-Second Auto-Wake Self-Test** inside the app.

## Setup Inside the App
1. Tap **1. Start Screen-Off Wake Service** (grant Notification permission if asked).
2. On Android 13/14: Tap **2. Allow Restricted Settings**, tap the top-right **3 dots (⋮)** -> **Allow restricted settings**.
3. Tap **3. Enable Accessibility Service** -> turn ON **${safeAppName} Volume Controller**.
4. Tap **4. Allow Background Running** and lock the app in Recents.
5. Tap **Test B: Lock Now & Auto-Wake in 5 Seconds** to verify your phone wakes reliably!
`;

  const files: GeneratedProjectFile[] = [
    {
      path: `app/src/main/java/${pkgPath}/WakeManager.kt`,
      language: 'kotlin',
      category: 'Core Service',
      summary: 'Reliable wakeup engine combining timed WakeLock (no premature release) with WakeHelperActivity and live status tracking.',
      content: wakeManagerKt,
    },
    {
      path: `app/src/main/java/${pkgPath}/WakeHelperActivity.kt`,
      language: 'kotlin',
      category: 'Core Service',
      summary: 'Transparent activity calling setTurnScreenOn(true) + setShowWhenLocked(true) for reliable screen wake on Android 9 through Android 15.',
      content: wakeHelperActivityKt,
    },
    {
      path: `app/src/main/java/${pkgPath}/VolumeKeyAccessibilityService.kt`,
      language: 'kotlin',
      category: 'Core Service',
      summary: 'Intercepts Volume Up/Down presses, evaluates double-click/long-press/chord timing, guards pocket proximity, and locks via Android 9+ Global Action.',
      content: accessibilityServiceKt,
    },
    {
      path: `app/src/main/java/${pkgPath}/ScreenWakeForegroundService.kt`,
      language: 'kotlin',
      category: 'Core Service',
      summary: 'Holds CPU partial wake lock + silent-primed MediaSessionCompat so Volume clicks are delivered while the display is off.',
      content: foregroundServiceKt,
    },
    {
      path: `app/src/main/java/${pkgPath}/WakeConfig.kt`,
      language: 'kotlin',
      category: 'Core Service',
      summary: 'Compiled constants reflecting your exact triggers, double-click window, and safety toggles.',
      content: wakeConfigKt,
    },
    {
      path: `app/src/main/java/${pkgPath}/MainActivity.kt`,
      language: 'kotlin',
      category: 'UI & Receivers',
      summary: 'Live diagnostic dashboard with Android 13/14 Restricted Settings shortcut, permission checks, and 5-second Auto-Wake Self-Test.',
      content: mainActivityKt,
    },
    ...(config.startOnBoot
      ? [
          {
            path: `app/src/main/java/${pkgPath}/BootCompletedReceiver.kt`,
            language: 'kotlin' as const,
            category: 'UI & Receivers' as const,
            summary: 'Safely restarts the Screen-Off Volume Service after reboot with Android 14 exception handling.',
            content: bootReceiverKt,
          },
        ]
      : []),
    {
      path: 'app/src/main/AndroidManifest.xml',
      language: 'xml',
      category: 'Manifest & Res',
      summary: 'Declares WakeHelperActivity, AccessibilityService, Foreground Service, and Android 9–14 permissions.',
      content: manifestXml,
    },
    {
      path: 'app/src/main/res/xml/accessibility_service_config.xml',
      language: 'xml',
      category: 'Manifest & Res',
      summary: 'Enables flagRequestFilterKeyEvents so Android delivers hardware volume clicks to the app.',
      content: accessibilityConfigXml,
    },
    {
      path: 'app/src/main/res/values/strings.xml',
      language: 'xml',
      category: 'Manifest & Res',
      summary: 'App label and Accessibility permission explanation text.',
      content: stringsXml,
    },
    {
      path: 'app/build.gradle.kts',
      language: 'gradle',
      category: 'Build & CI',
      summary: 'Android Gradle module configured for Android 8.0–15 (minSdk 26, targetSdk 34) with AndroidX Media.',
      content: appBuildGradle,
    },
    {
      path: 'build.gradle.kts',
      language: 'gradle',
      category: 'Build & CI',
      summary: 'Root Gradle build plugin declarations.',
      content: rootBuildGradle,
    },
    {
      path: 'settings.gradle.kts',
      language: 'gradle',
      category: 'Build & CI',
      summary: 'Gradle repositories and module registration.',
      content: settingsGradle,
    },
    {
      path: 'gradle.properties',
      language: 'properties',
      category: 'Build & CI',
      summary: 'JVM memory and AndroidX flags for Gradle.',
      content: gradleProperties,
    },
    {
      path: '.github/workflows/build-apk.yml',
      language: 'yaml',
      category: 'Build & CI',
      summary: 'One-click GitHub Actions workflow that compiles an installable Realme APK in the cloud.',
      content: githubWorkflowYml,
    },
    {
      path: 'README.md',
      language: 'markdown',
      category: 'Build & CI',
      summary: 'Build instructions, v1.1.0 fixes, and Android 9–14 setup steps.',
      content: readmeMd,
    },
  ];

  return files;
}

export async function downloadAndroidProjectZip(config: C2WakeConfig): Promise<void> {
  const files = generateAndroidProject(config);
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.path, file.content);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${(config.appName.trim() || 'C2Wake').replace(/\s+/g, '-')}-Realme-Android-v1.1.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
