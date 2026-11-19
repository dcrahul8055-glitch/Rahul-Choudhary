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

    <!-- Required to wake the Realme display when the screen is off -->
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
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

        <!-- Keeps Volume button wake listener alive while screen is off on ColorOS 6 -->
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
    <string name="accessibility_service_description">Intercepts Realme C2 Volume Up/Down presses to turn the screen on and lock the screen without using the physical power button.</string>
</resources>
`;

  const wakeConfigKt = `package ${config.packageName}

/**
 * Generated configuration for Realme C2 (RMX1941 / RMX1945 · ColorOS 6 / Android 9).
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
import android.os.VibrationEffect
import android.os.Vibrator
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent

class VolumeKeyAccessibilityService : AccessibilityService(), SensorEventListener {

    private lateinit var powerManager: PowerManager
    private lateinit var audioManager: AudioManager
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
        val screenOn = powerManager.isInteractive
        if (!screenOn && WakeConfig.WAKE_GESTURE == "LONG_PRESS") {
            wakeScreenIfAllowed()
        } else if (screenOn && WakeConfig.LOCK_GESTURE == "LONG_PRESS") {
            lockScreenNow()
        }
    }

    private val lockActionReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == WakeConfig.ACTION_LOCK_SCREEN_NOW) {
                lockScreenNow()
            }
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager

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
    }

    override fun onKeyEvent(event: KeyEvent): Boolean {
        val code = event.keyCode
        if (code != KeyEvent.KEYCODE_VOLUME_UP && code != KeyEvent.KEYCODE_VOLUME_DOWN) {
            return super.onKeyEvent(event)
        }

        val screenOn = powerManager.isInteractive

        // Track simultaneous press for Volume Up + Down chord
        if (event.action == KeyEvent.ACTION_DOWN) {
            if (code == KeyEvent.KEYCODE_VOLUME_UP) volUpPressed = true
            if (code == KeyEvent.KEYCODE_VOLUME_DOWN) volDownPressed = true

            if (screenOn && WakeConfig.LOCK_GESTURE == "CHORD" && volUpPressed && volDownPressed) {
                handler.removeCallbacks(longPressRunnable)
                lockScreenNow()
                return true
            }

            // Avoid hijacking normal media/call volume while screen is on
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
            return !screenOn // Consume screen-off presses so volume doesn't jump unexpectedly
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
                    wakeScreenIfAllowed()
                    return true
                }
                if (WakeConfig.WAKE_GESTURE == "DOUBLE_CLICK" && isDoubleClick) {
                    lastClickTimeMs = 0L
                    wakeScreenIfAllowed()
                    return true
                }
            }

            if (screenOn && WakeConfig.LOCK_GESTURE == "DOUBLE_CLICK" && matchesKey(code, WakeConfig.LOCK_KEY)) {
                if (WakeConfig.MEDIA_SAFEGUARD && isAudioOrCallActive()) {
                    return false
                }
                if (isDoubleClick) {
                    lastClickTimeMs = 0L
                    lockScreenNow()
                    return true
                }
            }

            lastClickKey = code
            lastClickTimeMs = now
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
        val mode = audioManager.mode
        val inCall = mode == AudioManager.MODE_IN_CALL || mode == AudioManager.MODE_IN_COMMUNICATION || mode == AudioManager.MODE_RINGTONE
        return audioManager.isMusicActive || inCall
    }

    @Suppress("DEPRECATION")
    private fun wakeScreenIfAllowed() {
        if (WakeConfig.POCKET_PROTECTION && isNearPocket) return
        val wakeLock = powerManager.newWakeLock(
            PowerManager.SCREEN_BRIGHT_WAKE_LOCK or
                PowerManager.ACQUIRE_CAUSES_WAKEUP or
                PowerManager.ON_AFTER_RELEASE,
            "${config.packageName}:VolumeWake"
        )
        wakeLock.acquire(3000L)
        if (wakeLock.isHeld) wakeLock.release()
        triggerHaptic()
    }

    private fun lockScreenNow() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            // Android 9 Pie (Realme C2 ColorOS 6) supports native lock screen without Device Admin
            performGlobalAction(GLOBAL_ACTION_LOCK_SCREEN)
            triggerHaptic()
        }
    }

    private fun triggerHaptic() {
        if (!WakeConfig.HAPTIC_FEEDBACK) return
        val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createOneShot(28, VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(28)
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
 * Keeps hardware volume button detection reliable while the Realme screen is turned off.
 * Compatible with Realme C2 (Android 9) and Realme 12x 5G RMX3998 (Android 14).
 * Engine mode: ${config.wakeEngine}
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

        if (WakeConfig.POCKET_PROTECTION) {
            sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
            sensorManager?.getDefaultSensor(Sensor.TYPE_PROXIMITY)?.let {
                sensorManager?.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL)
            }
        }

        if (WakeConfig.WAKE_ENGINE == "MEDIA_SESSION") {
            initMediaSessionVolumeIntercept()
        } else {
            initPartialWakeLock()
        }
    }

    private fun initMediaSessionVolumeIntercept() {
        val session = MediaSessionCompat(this, "C2WakeVolumeSession")
        session.setPlaybackState(
            PlaybackStateCompat.Builder()
                .setState(PlaybackStateCompat.STATE_PLAYING, 0L, 0f)
                .build()
        )

        val volumeProvider = object : VolumeProviderCompat(VOLUME_CONTROL_RELATIVE, 100, 50) {
            override fun onAdjustVolume(direction: Int) {
                if (direction == 0 || powerManager.isInteractive) return
                handleScreenOffVolumeStep(direction)
            }
        }

        session.setPlaybackToRemote(volumeProvider)
        session.isActive = true
        mediaSession = session
    }

    private fun initPartialWakeLock() {
        // Keeps the CPU awake in low-power state so AccessibilityService.onKeyEvent fires while screen is off
        partialWakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "${config.packageName}:KeepKeyEventsAlive"
        ).apply {
            acquire()
        }
    }

    private fun handleScreenOffVolumeStep(direction: Int) {
        val isUp = direction > 0
        val matchesTarget = when (WakeConfig.WAKE_KEY) {
            "VOL_UP" -> isUp
            "VOL_DOWN" -> !isUp
            else -> true
        }
        if (!matchesTarget) return

        val now = SystemClock.elapsedRealtime()
        val delta = now - lastPressMs
        val isDouble = (direction == lastDirection) && (delta in 1..WakeConfig.DOUBLE_CLICK_WINDOW_MS)

        if (WakeConfig.WAKE_GESTURE == "SINGLE_CLICK") {
            wakeDisplay()
        } else if (WakeConfig.WAKE_GESTURE == "DOUBLE_CLICK" && isDouble) {
            lastPressMs = 0L
            wakeDisplay()
            return
        }

        lastDirection = direction
        lastPressMs = now
    }

    @Suppress("DEPRECATION")
    private fun wakeDisplay() {
        if (WakeConfig.POCKET_PROTECTION && isNearPocket) return
        val lock = powerManager.newWakeLock(
            PowerManager.SCREEN_BRIGHT_WAKE_LOCK or
                PowerManager.ACQUIRE_CAUSES_WAKEUP or
                PowerManager.ON_AFTER_RELEASE,
            "${config.packageName}:ScreenWake"
        )
        lock.acquire(3000L)
        if (lock.isHeld) lock.release()
    }

    private fun buildNotification(): Notification {
        val openAppIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("${safeAppName} Active on Realme C2")
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
        mediaSession?.isActive = false
        mediaSession?.release()
        partialWakeLock?.let { if (it.isHeld) it.release() }
        sensorManager?.unregisterListener(this)
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

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(56, 72, 56, 56)
        }

        val title = TextView(this).apply {
            text = "${safeAppName} — Realme C2"
            textSize = 22f
            setPadding(0, 0, 0, 16)
        }

        val summary = TextView(this).apply {
            text = """
                Screen Wake: ${formatWakeGestureLabel(config.wakeGesture)} on ${formatKeyLabel(config.wakeKey)}
                Screen Lock: ${formatLockGestureLabel(config.lockGesture)} (${formatKeyLabel(config.lockKey)})
                Double-Click Window: ${config.doubleClickWindowMs} ms
                Pocket Protection: ${config.pocketProtection ? 'Enabled' : 'Disabled'}
            """.trimIndent()
            textSize = 14f
            setPadding(0, 0, 0, 36)
        }

        val startServiceBtn = Button(this).apply {
            text = "1. Start Screen-Off Volume Service"
            setOnClickListener {
                val intent = Intent(this@MainActivity, ScreenWakeForegroundService::class.java)
                ContextCompat.startForegroundService(this@MainActivity, intent)
            }
        }

        val accessibilityBtn = Button(this).apply {
            text = "2. Enable Accessibility Service"
            setOnClickListener {
                startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
            }
        }

        val batteryBtn = Button(this).apply {
            text = "3. Allow Background Running (Battery)"
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
            text = "Test Lock Screen Now"
            setOnClickListener {
                sendBroadcast(Intent(WakeConfig.ACTION_LOCK_SCREEN_NOW).setPackage(packageName))
            }
        }

        container.addView(title)
        container.addView(summary)
        container.addView(startServiceBtn)
        container.addView(accessibilityBtn)
        container.addView(batteryBtn)
        container.addView(testLockBtn)

        setContentView(container)
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
            val serviceIntent = Intent(context, ScreenWakeForegroundService::class.java)
            ContextCompat.startForegroundService(context, serviceIntent)
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
        minSdk = 26 // Realme C2 runs Android 9 Pie (API 28)
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
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

  const githubWorkflowYml = `name: Build Realme C2 APK

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

      - name: Upload Realme C2 APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: C2Wake-RealmeC2-APK
          path: app/build/outputs/apk/debug/app-debug.apk
`;

  const readmeMd = `# ${safeAppName} — Custom Volume Screen Controller for Realme C2

Tailored specifically for the **Realme C2 (RMX1941 / RMX1945, ColorOS 6 / Android 9 Pie)** when the physical power button is damaged or unresponsive.

## Your Configured Gestures

- **Screen Wake (Screen OFF):** ${formatWakeGestureLabel(config.wakeGesture)} on ${formatKeyLabel(config.wakeKey)}
- **Screen Lock (Screen ON):** ${formatLockGestureLabel(config.lockGesture)} (${formatKeyLabel(config.lockKey)})
- **Double-Click Detection Window:** ${config.doubleClickWindowMs} ms
- **Pocket Protection (Proximity Sensor):** ${config.pocketProtection ? 'Enabled' : 'Disabled'}
- **Media / Call Safeguard:** ${config.mediaSafeguard ? 'Enabled' : 'Disabled'}
- **Screen-Off Engine:** ${config.wakeEngine === 'MEDIA_SESSION' ? 'MediaSession Volume Intercept (Low Battery)' : 'Partial WakeLock + Accessibility Key Filter (Maximum Compatibility)'}

## How to Build the Installable APK (2 Options)

### Option A: Build Free in the Cloud via GitHub (No Android Studio Required)
1. Create a new repository on GitHub and upload all files from this ZIP.
2. Open the **Actions** tab in your GitHub repository.
3. Click **Build Realme C2 APK** -> **Run workflow**.
4. Once complete (~2 minutes), download **C2Wake-RealmeC2-APK**, unzip it, transfer \`app-debug.apk\` to your Realme C2, and tap to install.

### Option B: Build Locally with Android Studio
1. Open this extracted folder in Android Studio.
2. Wait for Gradle sync to finish.
3. Click **Build -> Build Bundle(s) / APK(s) -> Build APK(s)**.
4. Copy \`app/build/outputs/apk/debug/app-debug.apk\` to your Realme C2 and install.

## Required Realme C2 (ColorOS 6) Settings After Install

ColorOS 6 aggressively stops background apps unless you enable these four settings:

1. Open **${safeAppName}** and tap **Start Screen-Off Volume Service**.
2. Tap **Enable Accessibility Service** -> turn ON **${safeAppName} Volume Controller**.
3. Open Recent Apps, pull down on **${safeAppName}** (or tap the menu icon), and tap **Lock** so ColorOS never clears it.
4. Go to **Settings -> App Management -> ${safeAppName} -> Power Saver** -> enable **Allow Background Running** and **Allow Auto-Startup**.
`;

  const files: GeneratedProjectFile[] = [
    {
      path: `app/src/main/java/${pkgPath}/VolumeKeyAccessibilityService.kt`,
      language: 'kotlin',
      category: 'Core Service',
      summary: 'Intercepts Volume Up/Down presses, evaluates double-click/long-press/chord timing, guards pocket proximity, and triggers native Android 9 screen lock.',
      content: accessibilityServiceKt,
    },
    {
      path: `app/src/main/java/${pkgPath}/ScreenWakeForegroundService.kt`,
      language: 'kotlin',
      category: 'Core Service',
      summary: 'Keeps volume-key wake active while the Realme C2 display is turned off and adds a persistent Lock Screen notification action.',
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
      summary: 'Lightweight launcher screen with one-tap Accessibility, Battery Optimization, Service Start, and Test Lock actions.',
      content: mainActivityKt,
    },
    ...(config.startOnBoot
      ? [
          {
            path: `app/src/main/java/${pkgPath}/BootCompletedReceiver.kt`,
            language: 'kotlin' as const,
            category: 'UI & Receivers' as const,
            summary: 'Automatically restarts the Screen-Off Volume Service after your Realme C2 reboots.',
            content: bootReceiverKt,
          },
        ]
      : []),
    {
      path: 'app/src/main/AndroidManifest.xml',
      language: 'xml',
      category: 'Manifest & Res',
      summary: 'Declares WAKE_LOCK, Foreground Service, Accessibility Service binding, and boot receiver permissions.',
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
      summary: 'App label and Accessibility permission explanation text shown in ColorOS 6 settings.',
      content: stringsXml,
    },
    {
      path: 'app/build.gradle.kts',
      language: 'gradle',
      category: 'Build & CI',
      summary: 'Android Gradle module configured for Realme C2 (minSdk 26 / Android 9 Pie compatible) with AndroidX Media.',
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
      summary: 'One-click GitHub Actions workflow that compiles an installable Realme C2 APK in the cloud for free.',
      content: githubWorkflowYml,
    },
    {
      path: 'README.md',
      language: 'markdown',
      category: 'Build & CI',
      summary: 'Build instructions and Realme C2 ColorOS 6 setup checklist.',
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
  anchor.download = `${(config.appName.trim() || 'C2Wake').replace(/\s+/g, '-')}-Realme-Android-Project.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
