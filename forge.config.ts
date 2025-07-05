import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import * as path from 'path';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: path.join(__dirname, 'assets', 'icon'),
    appBundleId: 'com.yourcompany.screenpilot',
    name: 'ScreenPilot',
    appCategoryType: 'public.app-category.productivity',
    osxSign: {
      identity: process.env.APPLE_IDENTITY || 'Developer ID Application: Your Name (TEAM_ID)',
      'hardened-runtime': true,
      entitlements: 'build/entitlements.mac.plist',
      'entitlements-inherit': 'build/entitlements.mac.plist',
      'signature-flags': 'library'
    } as any,
    osxNotarize: process.env.APPLE_ID ? {
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_PASSWORD || process.env.APPLE_ID_PASSWORD!,
      teamId: process.env.APPLE_TEAM_ID!
    } : undefined
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      certificateFile: process.env.WINDOWS_CERTIFICATE_FILE,
      certificatePassword: process.env.WINDOWS_CERTIFICATE_PASSWORD
    }),
    new MakerZIP({}, ['darwin']),
    new MakerDMG({
      format: 'UDZO',
      icon: path.join(__dirname, 'assets', 'icon.icns'),
      background: path.join(__dirname, 'assets', 'dmg-background.png'),
      window: {
        size: {
          width: 600,
          height: 400
        }
      },
      contents: (opts: any) => [
        {
          x: 448,
          y: 200,
          type: 'link',
          path: '/Applications'
        },
        {
          x: 192,
          y: 200,
          type: 'file',
          path: opts.appPath
        }
      ]
    } as any),
    new MakerRpm({}),
    new MakerDeb({
      options: {
        maintainer: 'ScreenPilot Team',
        homepage: 'https://screenpilot.app'
      }
    })
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
        },
        {
          entry: 'src/renderer/preload.ts',
          config: 'vite.preload.config.ts',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'screenpilot',
          name: 'screenpilot-macos'
        },
        prerelease: false,
        draft: true
      }
    }
  ]
};

export default config;