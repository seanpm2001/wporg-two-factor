/**
 * WordPress dependencies
 */
import { Button, Flex, Notice, Spinner, Modal } from '@wordpress/components';
import { useCallback, useContext, useState } from '@wordpress/element';
import { Icon, cancelCircleFilled } from '@wordpress/icons';
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import { GlobalContext } from '../../script';
import { refreshRecord } from '../../utilities/common';
import ListKeys from './list-keys';
import RegisterKey from './register-key';

/**
 * Render the WebAuthn setting.
 *
 * @param {Object}   props
 * @param {Function} props.onKeyAdd
 */
export default function WebAuthn( { onKeyAdd = () => {} } ) {
	const {
		user: { userRecord, webAuthnEnabled },
		setGlobalNotice,
	} = useContext( GlobalContext );
	const {
		record: { id: userId, '2fa_webauthn_keys': keys },
	} = userRecord;
	const [ flow, setFlow ] = useState( 'manage' );
	const [ statusError, setStatusError ] = useState( '' );
	const [ statusWaiting, setStatusWaiting ] = useState( false );
	const [ confirmingDisable, setConfirmingDisable ] = useState( false );

	/**
	 * Clear any notices then move to the desired step in the flow
	 */
	const updateFlow = useCallback(
		( nextFlow ) => {
			setGlobalNotice( '' );
			setStatusError( '' );
			setFlow( nextFlow );
		},
		[ setGlobalNotice ]
	);

	/**
	 * Display the confirmation modal for disabling the WebAuthn provider.
	 */
	const showConfirmDisableModal = useCallback( () => {
		setConfirmingDisable( true );
	}, [] );

	/**
	 * Remove the confirmation modal for disabling the WebAuthn provider.
	 */
	const hideConfirmDisableModal = useCallback( () => {
		setConfirmingDisable( false );
	}, [] );

	/**
	 * Toggle enablement of the WebAuthn provider.
	 */
	const toggleProvider = useCallback( async () => {
		const newStatus = webAuthnEnabled ? 'disable' : 'enable';

		try {
			setGlobalNotice( '' );
			setStatusError( '' );
			setStatusWaiting( true );

			await apiFetch( {
				path: '/wporg-two-factor/1.0/provider-status',
				method: 'POST',
				data: {
					user_id: userId,
					provider: 'TwoFactor_Provider_WebAuthn',
					status: newStatus,
				},
			} );

			await refreshRecord( userRecord );
			setGlobalNotice( `Successfully ${ newStatus }d Security Keys.` );
		} catch ( error ) {
			setStatusError( error?.message || error?.responseJSON?.data || error );
		} finally {
			hideConfirmDisableModal();
			setStatusWaiting( false );
		}
	}, [ webAuthnEnabled, userId, userRecord, setGlobalNotice, hideConfirmDisableModal ] );

	/**
	 * Handle post-registration processing.
	 */
	const onRegisterSuccess = useCallback( async () => {
		if ( ! webAuthnEnabled ) {
			await toggleProvider();
		}

		updateFlow( 'manage' );
		onKeyAdd();
	}, [ webAuthnEnabled, toggleProvider, updateFlow, onKeyAdd ] );

	if ( 'register' === flow ) {
		return (
			<Flex className="wporg-2fa__webauthn-register" direction="column">
				<RegisterKey
					onSuccess={ onRegisterSuccess }
					onCancel={ () => updateFlow( 'manage' ) }
				/>
			</Flex>
		);
	}

	return (
		<>
			<p className="wporg-2fa__screen-intro">
				A security key is a physical or software-based device that adds an extra layer of
				authentication and protection to online accounts. It generates unique codes or
				cryptographic signatures to verify the user&apos;s identity, offering stronger
				security than passwords alone.
			</p>

			{ keys.length > 0 && <ListKeys /> }

			<div className="wporg-2fa__submit-actions">
				<Button variant="primary" onClick={ () => updateFlow( 'register' ) }>
					Register new key
				</Button>

				{ keys.length > 0 && (
					<Button
						variant="secondary"
						onClick={ webAuthnEnabled ? showConfirmDisableModal : toggleProvider }
						disabled={ statusWaiting }
						isBusy={ statusWaiting && ! webAuthnEnabled }
					>
						{ `${
							// eslint-disable-next-line no-nested-ternary
							statusWaiting ? 'Enabling' : webAuthnEnabled ? 'Disable' : 'Enable'
						} security keys` }
					</Button>
				) }
			</div>

			{ statusError && (
				<Notice status="error" isDismissible={ false }>
					<Icon icon={ cancelCircleFilled } />
					{ statusError }
				</Notice>
			) }

			{ confirmingDisable && (
				<ConfirmDisableKeys
					error={ statusError }
					disabling={ statusWaiting }
					onClose={ hideConfirmDisableModal }
					onConfirm={ toggleProvider }
				/>
			) }
		</>
	);
}

/**
 * Prompt the user to confirm they want to disable security keys.
 *
 * @param {Object}   props
 * @param {Function} props.onConfirm
 * @param {Function} props.onClose
 * @param {boolean}  props.disabling
 */
function ConfirmDisableKeys( { onConfirm, onClose, disabling } ) {
	return (
		<Modal
			title={ `Disable security keys` }
			className="wporg-2fa__confirm-disable-keys"
			onRequestClose={ onClose }
		>
			<p className="wporg-2fa__screen-intro">
				Are you sure you want to disable security keys?
			</p>

			{ disabling ? (
				<div className="wporg-2fa__process-status">
					<Spinner />
				</div>
			) : (
				<div className="wporg-2fa__submit-actions">
					<Button variant="primary" isDestructive onClick={ onConfirm }>
						Disable security keys
					</Button>

					<Button variant="secondary" onClick={ onClose }>
						Cancel
					</Button>
				</div>
			) }
		</Modal>
	);
}
