/**
 * WordPress dependencies
 */
import { useCallback, useContext, useState } from '@wordpress/element';
import { Button, Flex } from '@wordpress/components';
import { lock, edit, reusableBlock } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import ScreenNavigation from './screen-navigation';
import TOTP from './totp';
import WebAuthn from './webauthn/webauthn';
import BackupCodes from './backup-codes';
import SetupProgressBar from './setup-progress-bar';
import { GlobalContext } from '../script';

const WordPressLogo = () => (
	<svg xmlns="http://www.w3.org/2000/svg" role="img" width="200" height="52" viewBox="0 0 329 52">
		<path
			fill="currentColor"
			d="M4.33 26a21.68 21.68 0 0 0 12.22 19.5L6.21 17.18A21.66 21.66 0 0 0 4.33 26ZM26.38 27.89l-6.5 18.89a21.31 21.31 0 0 0 6.12.89 21.77 21.77 0 0 0 7.2-1.23 1.429 1.429 0 0 1-.16-.3l-6.66-18.25Z"
		></path>
		<path
			fill="currentColor"
			d="M26 0a26 26 0 1 0 0 52 26 26 0 0 0 0-52Zm20.27 39.66a24.47 24.47 0 0 1-29.78 8.86 24.49 24.49 0 0 1-13-13 24.4 24.4 0 0 1 5.23-26.8 24.46 24.46 0 0 1 26.79-5.24 24.49 24.49 0 0 1 13 13 24.42 24.42 0 0 1-2.25 23.17l.01.01Z"
		></path>
		<path
			fill="currentColor"
			d="M45 15.61c.103.736.153 1.477.15 2.22a20.38 20.38 0 0 1-1.65 7.76l-6.61 19.14A21.65 21.65 0 0 0 45 15.61ZM40.63 24.91a11.45 11.45 0 0 0-1.79-6c-1.1-1.78-2.13-3.29-2.13-5.08A3.76 3.76 0 0 1 40.35 10h.28A21.65 21.65 0 0 0 7.9 14.1h1.39c2.27 0 5.78-.27 5.78-.27a.9.9 0 0 1 .13 1.79s-1.17.13-2.47.2l7.88 23.47 4.75-14.22L22 15.84c-1.17-.07-2.27-.2-2.27-.2a.9.9 0 0 1 .14-1.79s3.57.27 5.7.27c2.13 0 5.78-.27 5.78-.27a.9.9 0 0 1 .14 1.79s-1.18.13-2.48.2l7.83 23.29 2.23-7.08a25.171 25.171 0 0 0 1.56-7.14ZM145.83 19.3h-10.34v1.1c3.23 0 3.75.69 3.75 4.79v7.4c0 4.1-.52 4.85-3.75 4.85-2.48-.35-4.16-1.68-6.47-4.22l-2.66-2.89c3.58-.63 5.49-2.89 5.49-5.43 0-3.18-2.72-5.6-7.8-5.6h-10.17v1.1c3.24 0 3.76.69 3.76 4.79v7.4c0 4.1-.52 4.85-3.76 4.85v1.1h11.5v-1.1c-3.24 0-3.76-.75-3.76-4.85v-2.08h1l6.42 8h16.81c8.26 0 11.85-4.39 11.85-9.65 0-5.26-3.61-9.56-11.87-9.56Zm-24.21 9.42V21H124a3.551 3.551 0 0 1 3.76 3.87 3.536 3.536 0 0 1-3.76 3.85h-2.38Zm24.38 8h-.4c-2.08 0-2.37-.52-2.37-3.18V21H146c6 0 7.11 4.39 7.11 7.8S152 36.75 146 36.75v-.03ZM93.49 13.52H82.62v1.16c3.7 0 4.22 1 3.07 4.39l-4 11.78L76 13.52h-1.1l-5.85 17.33-3.87-11.78c-1.22-3.59-.29-4.39 3.12-4.39v-1.16H55.47v1.16c3.35 0 4.28.86 5.66 5.08l6.42 19.76h.75l6-18.08 5.9 18.08h.8l6.59-19.76c1.44-4.22 2.31-5.08 5.95-5.08l-.05-1.16ZM101.34 18.55c-6.35 0-11.55 4.68-11.55 10.34s5.2 10.4 11.55 10.4c6.35 0 11.56-4.68 11.56-10.4 0-5.72-5.2-10.34-11.56-10.34Zm0 18.89c-5.31 0-7.16-4.74-7.16-8.55 0-3.81 1.85-8.55 7.16-8.55 5.31 0 7.23 4.79 7.23 8.55 0 3.76-1.85 8.55-7.23 8.55ZM170.67 13.52h-12v1.16c3.88 0 4.57.92 4.57 6.7v9.24c0 5.78-.69 6.76-4.57 6.76v1.16H172v-1.16c-3.88 0-4.57-1-4.57-6.76v-2.83h3.29c6 0 9.25-3.12 9.25-7.11s-3.35-7.16-9.3-7.16Zm0 12.13h-3.29v-10h3.29c3.24 0 4.74 2.31 4.74 5.08s-1.5 4.92-4.74 4.92ZM219.32 34.15c-.52 1.9-1.15 2.6-5.26 2.6h-.81c-3 0-3.52-.7-3.52-4.8v-2.66c4.51 0 4.85.41 4.85 3.41h1.1v-8.61h-1.1c0 3-.34 3.41-4.85 3.41V21h3.18c4.1 0 4.74.69 5.26 2.6l.28 1.1h.93l-.38-5.4h-17v1.1c3.23 0 3.75.69 3.75 4.79v7.4c0 3.75-.44 4.69-3 4.83-2.42-.37-4.09-1.69-6.37-4.2l-2.65-2.89c3.58-.63 5.49-2.89 5.49-5.43 0-3.18-2.72-5.6-7.8-5.6h-10.17v1.1c3.23 0 3.75.69 3.75 4.79v7.4c0 4.1-.52 4.85-3.75 4.85v1.1h11.49v-1.1c-3.23 0-3.75-.75-3.75-4.85v-2.08h1l6.41 8h23.75l.35-5.43h-.87l-.31 1.07ZM189 28.72V21h2.37a3.542 3.542 0 0 1 3.75 3.87 3.532 3.532 0 0 1-.998 2.77 3.532 3.532 0 0 1-2.752 1.05l-2.37.03ZM234.52 27.91l-3.18-1.56c-2.78-1.27-4-2.08-4-3.59 0-1.51 1.5-2.36 3.12-2.36 3.06 0 4.57 2.25 5 5h1.21v-6.85h-1.09a3.415 3.415 0 0 1-.75 1.56 7.25 7.25 0 0 0-4.51-1.5c-3.58 0-6.18 2.36-6.18 5.14 0 2.54 1.73 4.45 4 5.54l3.29 1.56c2.37 1.1 3.7 2.26 3.7 3.76 0 1.73-1.5 2.77-3.35 2.77-3.41 0-6.07-2.25-6.53-6.06h-1.15v8h1.09a4.194 4.194 0 0 1 .93-2 8.481 8.481 0 0 0 5.2 2c3.87 0 7-2.54 7-6.18.07-1.77-1.03-3.9-3.8-5.23ZM252 27.91l-3.18-1.56c-2.78-1.27-4-2.08-4-3.59 0-1.51 1.5-2.36 3.12-2.36 3.06 0 4.57 2.25 5 5h1.21v-6.85H253a3.415 3.415 0 0 1-.75 1.56 7.25 7.25 0 0 0-4.51-1.5c-3.58 0-6.18 2.36-6.18 5.14 0 2.54 1.73 4.45 4 5.54l3.29 1.56c2.37 1.1 3.7 2.26 3.7 3.76 0 1.73-1.5 2.77-3.35 2.77-3.41 0-6.07-2.25-6.53-6.06h-1.15v8h1.09a4.194 4.194 0 0 1 .93-2 8.481 8.481 0 0 0 5.2 2c3.87 0 7.05-2.54 7.05-6.18.07-1.77-1.03-3.9-3.79-5.23ZM277.56 18.75a10.481 10.481 0 0 0-10.68 10.17 10.47 10.47 0 0 0 10.68 10.16c5.9 0 10.71-4.58 10.71-10.16s-4.81-10.17-10.71-10.17Zm0 19c-5.52 0-7.63-4.91-7.63-8.88 0-3.97 2.07-8.87 7.63-8.87 5.56 0 7.66 4.94 7.66 8.92 0 3.98-2.11 8.88-7.66 8.88v-.05ZM301.71 33.79l-3.14-3.69c3.63-.38 5.71-2.59 5.71-5.38 0-3-2.44-5.42-6.89-5.42h-8.47v.7c2.66 0 3.05.51 3.05 3.72v10.39c0 3.21-.39 3.76-3.05 3.76v.67h8.66v-.67c-2.66 0-3.05-.55-3.05-3.76v-4H296l6.35 8.44h5.29v-.67c-1.88-.24-4.03-1.88-5.93-4.09ZM294.53 29v-8.52h2.82c2.79 0 4.08 1.93 4.08 4.24 0 2.31-1.29 4.28-4.08 4.28h-2.82ZM319.6 30.59v.64c2.21 0 3 .7 3 2.08 0 2.89-2.5 4.39-5.29 4.39-5.93 0-7.6-4.81-7.6-8.78 0-3.97 1.86-8.92 7-8.92 3.59 0 6.09 2.54 7 6.7h.64v-7h-.64a3.281 3.281 0 0 1-1.09 1.83 8.203 8.203 0 0 0-6-2.73 10.167 10.167 0 0 0-9.851 10.165 10.169 10.169 0 0 0 9.851 10.165c3.34 0 4.78-1.66 8.34-1.66V35c0-3.21.39-3.75 3.05-3.75v-.64l-8.41-.02ZM261.9 34.77a2.061 2.061 0 1 0 .288 4.112 2.061 2.061 0 0 0-.288-4.112Z"
		></path>
	</svg>
);

function DefaultView( { onSelect } ) {
	const [ selectedOption, setSelectedOption ] = useState( 'totp' );

	const handleOptionChange = ( event ) => {
		setSelectedOption( event.target.value );
	};

	const handleButtonClick = () => {
		if ( selectedOption === '' ) {
			return;
		}

		onSelect( selectedOption );
	};

	return (
		<>
			<p>
				As of <a href="">September 10, 2024</a>, all plugin committers will be required to have Two-Factor
				Authentication enabled.
			</p>
			<form className="wporg-2fa__first-time-default">
				<label htmlFor="totp" className="wporg-2fa__first-time-default-item">
					<input
						type="radio"
						id="totp"
						name="toggle"
						value="totp"
						checked={ selectedOption === 'totp' }
						onChange={ handleOptionChange }
					/>
					<div>
						<span>Setup One Time Password</span>
						<p>Use an application to get two-factor authentication codes.</p>
					</div>
				</label>
				<label htmlFor="webauthn" className="wporg-2fa__first-time-default-item" >
					<input
						type="radio"
						id="webauthn"
						name="toggle"
						value="webauthn"
						checked={ selectedOption === 'webauthn' }
						onChange={ handleOptionChange }
					/>
					<div>
						<span>Setup Security Key</span>
						<p>Use biometrics, digital cryptography, or hardware keys.</p>
					</div>
				</label>
			</form>
			<Flex className="wporg-2fa__submit-actions" justify="flex-start">
				<Button isPrimary onClick={ handleButtonClick }>
					Configure
				</Button>
			</Flex>
		</>
	);
}

/**
 * Render the correct component based on the URL.
 *
 */
export default function InitialSetup() {
	const { navigateToScreen, screen } = useContext( GlobalContext );
	const [ steps, setSteps ] = useState( [
		{
			id: 'home',
			title: 'Select Method',
			icon: edit,
		},
		{
			id: 'totp',
			title: 'Configure',
			icon: lock,
		},
		{
			id: 'backup-codes',
			title: 'Backup Codes',
			icon: reusableBlock,
		},
	] );

	// The index is the URL slug and the value is the React component.
	const components = {
		totp: (
			<TOTP
				onSuccess={ () => {
					navigateToScreen( 'backup-codes' );
				} }
			/>
		),
		'backup-codes': (
			<BackupCodes
				onSuccess={ () => {
					navigateToScreen( 'congratulations' );
				} }
			/>
		),
		webauthn: <WebAuthn />,
		home: (
			<DefaultView
				onSelect={ ( val ) => {
					navigateToScreen( val );

					/* This updates the second item in the steps array to be the right id */
					setSteps( ( prevSteps ) => {
						const updatedSteps = [ ...prevSteps ];

						updatedSteps[ 1 ] = {
							...updatedSteps[ 1 ],
							id: val,
						};

						return updatedSteps;
					} );
				} }
			/>
		),
		congratulations: (
			<div>
				<p>Two-Factor Authentication is now enabled.</p>
				<p>
					You can now
					<ScreenNavigation screen="home" anchorText="return to the settings" />
					page.
				</p>
			</div>
		),
	};

	const currentStepIndex = useCallback( () => {
		return steps.findIndex( ( step ) => step.id === screen );
	}, [ screen, steps ] )();

	const currentScreenComponent = (
		<ScreenNavigation
			screen={ screen }
			title={ steps[ currentStepIndex ].title }
			canNavigate={ currentStepIndex !== 0 }
		>
			<SetupProgressBar currentStep={ screen } steps={ steps } />
			{ components[ screen ] }
		</ScreenNavigation>
	);

	return (
		<div className="wporg-2fa__first-time">
			<WordPressLogo />
			<div className="wporg-2fa__first-time__inner">{ currentScreenComponent }</div>
		</div>
	);
}
