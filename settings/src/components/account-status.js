/**
 * WordPress dependencies
 */
import { Card, CardBody } from '@wordpress/components';
import { useContext } from '@wordpress/element';
import { Icon, cancelCircleFilled, check, chevronRight, warning } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { GlobalContext } from '../script';
import ScreenLink from './screen-link';

/**
 * Render the Account Status.
 */
export default function AccountStatus() {
	const {
		user: {
			userRecord: {
				record: {
					email,
					pending_email: pendingEmail,
					svn_password_created: svnPasswordSet,
					svn_password_required: svnPasswordRequired,
				},
			},
			hasPrimaryProvider,
			primaryProvider,
			totpEnabled,
			backupCodesEnabled,
			webAuthnEnabled,
		},
	} = useContext( GlobalContext );
	const emailStatus = pendingEmail ? 'pending' : 'ok';

	const backupBodyText =
		! backupCodesEnabled && ! hasPrimaryProvider
			? 'Please enable a Two-Factor security key or app before enabling backup codes.'
			: `You have
				${ backupCodesEnabled ? '' : 'not' }
				verified your backup codes.`;

	return (
		<div className={ 'wporg-2fa__account-status' }>
			<SettingStatusCard
				screen="password"
				status="enabled"
				headerText="Password"
				bodyText="You have a password configured, but can change it at any time."
			/>

			<SettingStatusCard
				screen="email"
				status={ emailStatus }
				headerText="Account email"
				bodyText={
					pendingEmail
						? `Your account email is pending a change to ${ pendingEmail }.`
						: `Your account email address is ${ email }.`
				}
			/>

			<SettingStatusCard
				screen="webauthn"
				status={ hasPrimaryProvider && ! webAuthnEnabled ? 'info' : webAuthnEnabled }
				headerText="Two-factor security key"
				bodyText={
					webAuthnEnabled
						? 'You have two-factor authentication enabled using security keys.'
						: 'You have not enabled security keys.'
				}
				isPrimary={ 'TwoFactor_Provider_WebAuthn' === primaryProvider && totpEnabled }
			/>

			<SettingStatusCard
				screen="totp"
				status={ hasPrimaryProvider && ! totpEnabled ? 'info' : totpEnabled }
				headerText="Two-factor app"
				bodyText={
					totpEnabled
						? 'You have two-factor authentication enabled using an app.'
						: 'You have not enabled an app.'
				}
				isPrimary={ 'Two_Factor_Totp' === primaryProvider && webAuthnEnabled }
			/>

			<SettingStatusCard
				screen="backup-codes"
				status={
					! hasPrimaryProvider && ! backupCodesEnabled ? 'pending' : backupCodesEnabled
				}
				headerText="Two-factor backup codes"
				bodyText={ backupBodyText }
				disabled={ ! hasPrimaryProvider }
			/>

			{ svnPasswordRequired || svnPasswordSet ? (
				<SettingStatusCard
					screen="svn-password"
					status={
						! svnPasswordRequired && ! svnPasswordSet ? 'info' : !! svnPasswordSet
					}
					headerText="SVN credentials"
					bodyText={
						! svnPasswordSet
							? 'You have not configured a SVN password for your account.'
							: 'You have an SVN password configured for your account.'
					}
				/>
			) : (
				''
			) }
		</div>
	);
}

/**
 * Render a card for the status of the given setting.
 *
 * @param props
 * @param props.screen
 * @param props.status
 * @param props.headerText
 * @param props.bodyText
 * @param props.disabled
 * @param props.isPrimary
 */
function SettingStatusCard( {
	screen,
	status,
	headerText,
	bodyText,
	isPrimary = false,
	disabled = false,
} ) {
	const cardContent = (
		<CardBody>
			<StatusIcon status={ status } />

			<div>
				<h3 aria-label={ 'Click to enter the ' + headerText + ' setting page.' }>
					{ headerText }
				</h3>

				<p className="wporg-2fa__status-card-body">{ bodyText }</p>
			</div>

			{ isPrimary && <div className="wporg-2fa__status-card-badge">Primary</div> }

			<Icon icon={ chevronRight } size={ 26 } className="wporg-2fa__status-card-open" />
		</CardBody>
	);

	let classes = 'wporg-2fa__status-card wporg-2fa__status-card-' + screen;

	if ( disabled ) {
		classes += ' is-disabled';
	}

	return (
		<Card className={ classes }>
			{ disabled ? cardContent : <ScreenLink screen={ screen } anchorText={ cardContent } /> }
		</Card>
	);
}

/**
 * Render the icon for the given status
 *
 * @param props
 * @param props.status
 */
function StatusIcon( { status } ) {
	let icon;

	if ( 'boolean' === typeof status ) {
		status = status ? 'enabled' : 'disabled';
	}

	switch ( status ) {
		case 'ok':
		case 'enabled':
			icon = check;
			break;

		case 'pending':
			icon = warning;
			break;

		case 'info':
		case 'error':
		case 'disabled':
		default:
			icon = cancelCircleFilled;
	}

	return <Icon icon={ icon } size={ 24 } className={ 'wporg-2fa__status-icon is-' + status } />;
}
