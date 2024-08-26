/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { useContext, useCallback, useEffect, useState } from '@wordpress/element';
import { Button, ButtonGroup, CheckboxControl, Flex, Notice, Spinner } from '@wordpress/components';
import { Icon, warning, cancelCircleFilled } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { GlobalContext } from '../script';
import { refreshRecord } from '../utilities/common';
import ScreenLink from './screen-link';
import CopyToClipboardButton from './copy-to-clipboard-button';
import PrintButton from './print-button';
import DownloadButton from './download-button';

/**
 * Setup and manage backup codes.
 *
 * @param props
 * @param props.onSuccess
 */
export default function BackupCodes( { onSuccess = () => {} } ) {
	const {
		user: { backupCodesEnabled, hasPrimaryProvider, backupCodesRemaining },
		backupCodesVerified,
	} = useContext( GlobalContext );
	const [ regenerating, setRegenerating ] = useState( false );

	// Prevent users from accessing directly through the URL.
	if ( ! hasPrimaryProvider ) {
		return (
			<Notice status="error" isDismissible={ false }>
				<Icon icon={ cancelCircleFilled } />
				Please
				<ScreenLink screen="home" anchorText="enable a Two-Factor security key or app" />
				before enabling backup codes.
			</Notice>
		);
	}

	if (
		! backupCodesEnabled ||
		backupCodesRemaining === 0 ||
		regenerating ||
		! backupCodesVerified
	) {
		return <Setup setRegenerating={ setRegenerating } onSuccess={ onSuccess } />;
	}

	return <Manage setRegenerating={ setRegenerating } />;
}

/**
 * Setup the Backup Codes provider.
 *
 * @param props
 * @param props.setRegenerating
 * @param props.onSuccess
 */
function Setup( { setRegenerating, onSuccess } ) {
	const {
		setGlobalNotice,
		user: { userRecord },
		setError,
		error,
		setBackupCodesVerified,
	} = useContext( GlobalContext );
	const [ backupCodes, setBackupCodes ] = useState( [] );
	const [ hasPrinted, setHasPrinted ] = useState( false );

	// Generate new backup codes and save them in usermeta.
	useEffect( () => {
		// useEffect callbacks can't be async directly, because that'd return the promise as a "cleanup" function.
		const generateCodes = async () => {
			// This will save the backup codes and enable the provider, which isn't really what we want, but that
			// mimics the upstream plugin. It's probably better to fix it there first, and then update this, to
			// make sure we stay in sync with upstream.
			// See https://github.com/WordPress/two-factor/issues/507
			try {
				const response = await apiFetch( {
					path: '/two-factor/1.0/generate-backup-codes',
					method: 'POST',
					data: {
						user_id: userRecord.record.id,
						enable_provider: true,
					},
				} );

				setBackupCodes( response.codes );

				// Update the Account Status screen in case they click `Back` without verifying the codes, but
				// don't redirect to the Manage screen yet. This is mainly due to the side-effects of
				// `two-factor/#507`, so it will need to be modified or maybe removed when that is fixed upstream.
				setBackupCodesVerified( false );
				await refreshRecord( userRecord );
			} catch ( apiFetchError ) {
				setError( apiFetchError );
			}
		};

		generateCodes();
	}, [] );

	// Finish the setup process.
	const handleFinished = useCallback( async () => {
		// TODO: Add try catch here after https://github.com/WordPress/wporg-two-factor/pull/187/files is merged.
		// The codes have already been saved to usermeta, see `generateCodes()` above.
		setBackupCodesVerified( true );
		setGlobalNotice( 'Backup codes have been enabled.' );
		setRegenerating( false );
		onSuccess();
	} );

	return (
		<>
			<div className="wporg-2fa__screen-intro">
				<p>
					Backup codes let you access your account if your primary two-factor
					authentication method is unavailable, like if your phone is lost or stolen. Each
					code can only be used once.
				</p>

				<p>Please print the codes and keep them in a safe place.</p>

				<Notice status="warning" isDismissible={ false }>
					<Icon icon={ warning } className="wporg-2fa__print-codes-warning" />
					Without access to the one-time password app or a backup code, you will lose
					access to your account. Once you navigate away from this page, you will not be
					be able to view these codes again.
				</Notice>
			</div>

			{ error ? (
				<Notice status="error" isDismissible={ false }>
					<Icon icon={ cancelCircleFilled } />
					{ error.message }
				</Notice>
			) : (
				<>
					<CodeList codes={ backupCodes } />

					<ButtonGroup>
						<CopyToClipboardButton codes={ backupCodes } />
						<PrintButton />
						<DownloadButton codes={ backupCodes } />
					</ButtonGroup>

					<CheckboxControl
						label="I have printed or saved these codes"
						checked={ hasPrinted }
						onChange={ setHasPrinted }
						disabled={ error }
					/>
				</>
			) }

			<Flex justify="flex-start" align="center" className="wporg-2fa__submit-actions">
				<Button
					isPrimary={ hasPrinted }
					isSecondary={ ! hasPrinted }
					disabled={ ! hasPrinted }
					onClick={ handleFinished }
				>
					All Finished
				</Button>
			</Flex>
		</>
	);
}

/**
 * Display a list of backup codes
 *
 * @param props
 * @param props.codes
 */
function CodeList( { codes } ) {
	return (
		<div className="wporg-2fa__backup-codes-list">
			{ ! codes.length && (
				<p>
					Generating backup codes...
					<Spinner />
				</p>
			) }

			{ codes.length > 0 && (
				<ol>
					{ codes.map( ( code ) => {
						return (
							<li key={ code } className="wporg-2fa__token">
								{ code.slice( 0, 4 ) + ' ' + code.slice( 4 ) }
							</li>
						);
					} ) }
				</ol>
			) }
		</div>
	);
}

/**
 * Render the screen where users can manage Backup Codes.
 *
 * @param props
 * @param props.setRegenerating
 */
function Manage( { setRegenerating } ) {
	const {
		user: { backupCodesRemaining },
	} = useContext( GlobalContext );

	return (
		<>
			<div className="wporg-2fa__screen-intro">
				<p>
					Backup codes let you access your account if your primary two-factor
					authentication method is unavailable, like if your phone is lost or stolen. Each
					code can only be used once.
				</p>

				{ backupCodesRemaining > 5 && (
					<p>
						You have <strong>{ backupCodesRemaining }</strong> backup codes remaining.
					</p>
				) }

				{ backupCodesRemaining <= 5 && (
					<Notice status="warning" isDismissible={ false }>
						<Icon icon={ warning } />
						<div>
							You only have <strong>{ backupCodesRemaining }</strong> backup codes
							remaining. Please regenerate and save new ones before you run out. If
							you don&apos;t, you won&apos;t be able to log into your account if you
							lose your phone.
						</div>
					</Notice>
				) }
			</div>

			<Button isSecondary onClick={ () => setRegenerating( true ) }>
				Generate new backup codes
			</Button>
		</>
	);
}
