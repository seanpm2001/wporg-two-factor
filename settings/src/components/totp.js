/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { Button, Flex, Modal, Notice, Spinner } from '@wordpress/components';
import { Icon, cancelCircleFilled } from '@wordpress/icons';
import { RawHTML, useCallback, useContext, useEffect, useRef, useState } from '@wordpress/element';

/**
 * Internal dependencies
 */
import ScreenLink from './screen-link';
import AutoTabbingInput from './auto-tabbing-input';
import { refreshRecord } from '../utilities/common';
import { GlobalContext } from '../script';
import Success from './success';

export default function TOTP( { onSuccess } ) {
	const {
		user: { totpEnabled },
	} = useContext( GlobalContext );
	const [ success, setSuccess ] = useState( false );

	const afterTimeout = useCallback( () => {
		setSuccess( false );

		onSuccess();
	}, [ onSuccess ] );

	if ( success ) {
		return (
			<Flex className="wporg-2fa__totp_success" direction="column">
				<Success
					message="Success! Your two-factor authentication app is set up."
					afterTimeout={ afterTimeout }
				/>
			</Flex>
		);
	}

	if ( totpEnabled ) {
		return <Manage />;
	}

	return <Setup setSuccess={ setSuccess } />;
}

/**
 * Setup the TOTP provider.
 *
 * @param props
 * @param props.setSuccess
 */
function Setup( { setSuccess } ) {
	const {
		user: { userRecord },
	} = useContext( GlobalContext );
	const {
		record: { id: userId },
	} = userRecord;
	const [ secretKey, setSecretKey ] = useState( '' );
	const [ qrCodeUrl, setQrCodeUrl ] = useState( '' );
	const [ error, setError ] = useState( '' );
	const [ setupMethod, setSetupMethod ] = useState( 'qr-code' );
	const [ inputs, setInputs ] = useState( Array( 6 ).fill( '' ) );
	const [ statusWaiting, setStatusWaiting ] = useState( false );

	// Fetch the data needed to setup TOTP.
	useEffect( () => {
		// useEffect callbacks can't be async directly, because that'd return the promise as a "cleanup" function.
		const fetchSetupData = async () => {
			const response = await apiFetch( {
				path: '/wporg-two-factor/1.0/totp-setup?user_id=' + userId,
			} );

			setSecretKey( response.secret_key );
			setQrCodeUrl( response.qr_code_url );
		};

		fetchSetupData();
	}, [ userId ] );

	// Enable TOTP when button clicked.
	const handleEnable = useCallback(
		async ( event ) => {
			event.preventDefault();

			const code = inputs.join( '' );

			try {
				setError( '' );
				setStatusWaiting( true );

				await apiFetch( {
					path: '/two-factor/1.0/totp/',
					method: 'POST',
					data: {
						user_id: userId,
						key: secretKey,
						code,
						enable_provider: true,
					},
				} );

				await refreshRecord( userRecord );
				setSuccess( true );
			} catch ( handleEnableError ) {
				setError( handleEnableError.message );
			} finally {
				setStatusWaiting( false );
			}
		},
		[ inputs, secretKey, userId, userRecord, setSuccess ]
	);

	return (
		<div className="wporg-2fa__totp_setup-container">
			<p className="wporg-2fa__screen-intro">
				Two-factor authentication adds an extra layer of security to your account. Use a
				phone app like{ ' ' }
				<a
					href="https://support.google.com/accounts/answer/1066447"
					target="_blank"
					rel="noreferrer"
				>
					Google Authenticator
				</a>{ ' ' }
				or{ ' ' }
				<a
					href="https://www.microsoft.com/ko-kr/security/mobile-authenticator-app"
					target="_blank"
					rel="noreferrer"
				>
					Microsoft Authenticator
				</a>{ ' ' }
				when logging in to WordPress.org.
			</p>

			{ 'qr-code' === setupMethod && (
				<SetupMethodQRCode setSetupMethod={ setSetupMethod } qrCodeUrl={ qrCodeUrl } />
			) }

			{ 'manual' === setupMethod && (
				<SetupMethodManual setSetupMethod={ setSetupMethod } secretKey={ secretKey } />
			) }

			<SetupForm
				handleEnable={ handleEnable }
				qrCodeUrl={ qrCodeUrl }
				secretKey={ secretKey }
				inputs={ inputs }
				setInputs={ setInputs }
				error={ error }
				setError={ setError }
				isBusy={ statusWaiting }
			/>
		</div>
	);
}

/**
 * Render the QR code methods for setting up TOTP in an app.
 *
 * @param props
 * @param props.setSetupMethod
 * @param props.qrCodeUrl
 */
function SetupMethodQRCode( { setSetupMethod, qrCodeUrl } ) {
	const handleClick = useCallback( () => setSetupMethod( 'manual' ) );

	return (
		<div className="wporg-2fa__totp_setup-method-container">
			<p>
				<strong>Scan the QR code with your authentication app&nbsp;</strong>
			</p>

			<Button variant="link" onClick={ handleClick }>
				Can&apos;t scan the QR code?
			</Button>

			<div className="wporg-2fa__qr-code">
				{ ! qrCodeUrl && 'Loading...' }

				{ qrCodeUrl && (
					<a href={ qrCodeUrl } aria-label="QR code to scan">
						<RawHTML>{ createQrCode( qrCodeUrl ) }</RawHTML>
					</a>
				) }
			</div>
		</div>
	);
}

/**
 * Render the manual method for setting up TOTP in an app.
 *
 * @param props
 * @param props.setSetupMethod
 * @param props.secretKey
 */
function SetupMethodManual( { setSetupMethod, secretKey } ) {
	const readableSecretKey = secretKey.match( /.{1,4}/g ).join( ' ' );

	const handleClick = useCallback( () => setSetupMethod( 'qr-code' ) );

	return (
		<div className="wporg-2fa__manual">
			<p>
				<strong>Enter this time code into your app&nbsp;</strong>
			</p>

			<Button variant="link" onClick={ handleClick }>
				Prefer to scan a QR code?
			</Button>

			<code>{ readableSecretKey }</code>
		</div>
	);
}

/*
 * Generate a QR code SVG.
 *
 * @param {string} data The data to encode in the QR code.
 */
function createQrCode( data ) {
	const { qrcode } = window; // Loaded via block.json.

	/*
	 * 0 = Automatically select the version, to avoid going over the limit of URL
	 *     length.
	 * L = Least amount of error correction, because it's not needed when scanning
	 *     on a monitor, and it lowers the image size.
	 */
	const qr = qrcode( 0, 'L' );
	qr.addData( data );
	qr.make();

	return qr.createSvgTag( 5 );
}

/**
 * Render the form for entering the TOTP code.
 *
 * @param props
 * @param props.handleEnable
 * @param props.qrCodeUrl
 * @param props.secretKey
 * @param props.inputs
 * @param props.setInputs
 * @param props.error
 * @param props.setError
 * @param props.isBusy
 */
function SetupForm( {
	handleEnable,
	qrCodeUrl,
	secretKey,
	inputs,
	setInputs,
	error,
	setError,
	isBusy,
} ) {
	const inputsRef = useRef( inputs );

	useEffect( () => {
		const prevInputs = inputsRef.current;
		inputsRef.current = inputs;

		// Clear the error if any of the inputs have changed
		if ( error && inputs.some( ( input, index ) => input !== prevInputs[ index ] ) ) {
			setError( '' );
		}
	}, [ error, inputs, inputsRef ] );

	const handleClearClick = useCallback( () => {
		setInputs( Array( 6 ).fill( '' ) );
	}, [] );

	const canSubmit = qrCodeUrl && secretKey && inputs.every( ( input ) => !! input );

	return (
		<div className="wporg-2fa__setup-form-container">
			{ error && (
				<Notice status="error" isDismissible={ false } className="is-shown">
					<Icon icon={ cancelCircleFilled } /> { error }
				</Notice>
			) }

			<form className="wporg-2fa__setup-form" onSubmit={ handleEnable }>
				<p>Enter the six digit code provided by the app:</p>

				<AutoTabbingInput
					inputs={ inputs }
					setInputs={ setInputs }
					error={ error }
					setError={ setError }
				/>

				<div className="wporg-2fa__submit-actions">
					<Button
						type="submit"
						variant="primary"
						disabled={ ! canSubmit }
						isBusy={ isBusy }
						aria-label="Submit input digits"
					>
						{ isBusy ? 'Verifying' : 'Enable' }
					</Button>
					<Button
						variant="secondary"
						onClick={ handleClearClick }
						aria-label="Clear all inputs"
					>
						Clear
					</Button>
				</div>
			</form>
		</div>
	);
}

/**
 * Disable the TOTP provider.
 */
function Manage() {
	const {
		user: { userRecord },
		setGlobalNotice,
	} = useContext( GlobalContext );
	const [ error, setError ] = useState( '' );
	const [ disabling, setDisabling ] = useState( false );
	const [ confirmingDisable, setConfirmingDisable ] = useState( false );

	/**
	 * Display the confirmation modal for disabling the TOTP provider.
	 */
	const showConfirmDisableModal = useCallback( () => {
		setConfirmingDisable( true );
	}, [] );

	/**
	 * Remove the confirmation modal for disabling the TOTP provider.
	 */
	const hideConfirmDisableModal = useCallback( () => {
		setConfirmingDisable( false );
	}, [] );

	// Disable TOTP when button clicked.
	const handleDisable = useCallback(
		async ( event ) => {
			event.preventDefault();
			setError( '' );
			setDisabling( true );

			try {
				await apiFetch( {
					path: '/two-factor/1.0/totp/',
					method: 'DELETE',
					data: { user_id: userRecord.record.id },
				} );

				await refreshRecord( userRecord );
				setGlobalNotice( 'Successfully disabled your two-factor app.' );
			} catch ( handleDisableError ) {
				hideConfirmDisableModal();
				setError( handleDisableError.message );
			} finally {
				setDisabling( false );
			}
		},
		[ hideConfirmDisableModal, setGlobalNotice, userRecord ]
	);

	return (
		<>
			<div className="wporg-2fa__screen-intro">
				<p>
					You&apos;ve enabled two-factor authentication on your account — smart move! When
					you log in to WordPress.org, you&apos;ll need to enter your username and
					password, and then enter a unique passcode generated by an app on your mobile
					device.
				</p>

				<p>
					Make sure you&apos;ve created{ ' ' }
					<ScreenLink screen="backup-codes" anchorText="backup codes" /> and saved them in
					a safe location, in case you ever lose your device. You may also need them when
					transitioning to a new device. Without them you may permanently lose access to
					your account.
				</p>

				<p>
					<strong>Status:</strong> Two-Factor app is currently{ ' ' }
					<span className="wporg-2fa__enabled-status">on</span>.
				</p>
			</div>

			<p className="wporg-2fa__submit-actions">
				<Button variant="secondary" onClick={ showConfirmDisableModal }>
					Disable Two-Factor app
				</Button>
			</p>

			{ error && (
				<Notice status="error" isDismissible={ false }>
					<Icon icon={ cancelCircleFilled } />
					{ error }
				</Notice>
			) }

			{ confirmingDisable && (
				<ConfirmDisableApp
					error={ error }
					disabling={ disabling }
					onClose={ hideConfirmDisableModal }
					onConfirm={ handleDisable }
				/>
			) }
		</>
	);
}

/**
 * Prompt the user to confirm they want to disable their two-factor app.
 *
 * @param {Object}   props
 * @param {Function} props.onConfirm
 * @param {Function} props.onClose
 * @param {boolean}  props.disabling
 */
function ConfirmDisableApp( { onConfirm, onClose, disabling } ) {
	return (
		<Modal
			title={ `Disable Two-Factor app` }
			className="wporg-2fa__confirm-disable-app"
			onRequestClose={ onClose }
		>
			<p className="wporg-2fa__screen-intro">
				Are you sure you want to disable your two-factor app?
			</p>

			{ disabling ? (
				<div className="wporg-2fa__process-status">
					<Spinner />
				</div>
			) : (
				<div className="wporg-2fa__submit-actions">
					<Button variant="primary" isDestructive onClick={ onConfirm }>
						Disable Two-Factor app
					</Button>

					<Button variant="tertiary" onClick={ onClose }>
						Cancel
					</Button>
				</div>
			) }
		</Modal>
	);
}
