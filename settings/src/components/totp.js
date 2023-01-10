/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';

//
export default function TOTP( { userRecord } ) {
	const enabledProviders = Object.values( userRecord.record[ '2fa_enabled_providers' ] );
	const totpStatus       = enabledProviders.includes( 'Two_Factor_Totp' ) ? 'enabled' : 'disabled';

	return (
		<>
			{ 'disabled' === totpStatus && <Setup /> }
			{ 'enabled' === totpStatus && <Manage /> }
		</>
	);
}

//
function Setup() {
	// todo after setting this up is done, check if they have backup codes, and if not, redirect them to that screen

	return (
		<>
			<p>
				Scan this QR code with the authenticator app on your mobile device.

				<a href="">
					Can't scan the code?
				</a>
			</p>

			<p>
				qr image
			</p>

			<p>
				Then enter the six digit code provided by the app:
			</p>

			<p>
				input field w/ placeholder text
			</p>

			<p>
				Not sure what this screen means? You may need to download Authy or Google Authenticator for your phone
				{/* add links to those. maybe pick different ones> */ }
			</p>

			<p>
				<Button isPrimary>
					Enable
				</Button>

				<Button isSecondary>
					Cancel
				</Button>
			</p>
		</>
	);
}

//
function Manage() {
	return (
		<>
			You've enabled two-step authentication on your account — smart move! When you log in to WordPress.com, you'll need to enter your username and password, as well as a unique passcode generated by an app on your mobile device.

			Switching to a new device? Follow these steps to avoid losing access to your account.
			https://wordpress.com/support/security/two-step-authentication/#moving-to-a-new-device

			Status: Two-step authentication is currently on.
		</>
	);
}