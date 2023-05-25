import { useSelect } from '@wordpress/data';
import { store as coreDataStore, useEntityRecord } from '@wordpress/core-data';

/**
 * Get the user.
 *
 * @param userId
 */
export function useUser( userId ) {
	const userRecord = useEntityRecord( 'root', 'user', userId );
	const isSaving = useSelect( ( select ) =>
		select( coreDataStore ).isSavingEntityRecord( 'root', 'user', userId )
	);

	const availableProviders = userRecord.record?.[ '2fa_available_providers' ] ?? [];
	const primaryProviders = [ 'Two_Factor_Totp', 'TwoFactor_Provider_WebAuthn' ];
	const hasPrimaryProvider = !! availableProviders.filter( ( provider ) =>
		primaryProviders.includes( provider )
	).length;

	return {
		userRecord: { ...userRecord },
		isSaving,
		hasPrimaryProvider,
	};
}

/**
 * Refresh a `useEntityRecord` object from the REST API.
 *
 * This is necessary after an the underlying data in the database has been changed by a method other than
 * `userRecord.save()`. When that happens, the `userRecord` object isn't automatically updated, and needs to be manually
 * refreshed to get the latest data.
 *
 * todo Replace this with native method if one is added in https://github.com/WordPress/gutenberg/issues/47746.
 *
 * @param userRecord An userRecord object that was generated by `useEntityRecord()`.
 */
export function refreshRecord( userRecord ) {
	// The fake key will be ignored by the REST API because it isn't a registered field. But the request will still
	// result in the latest data being returned.
	userRecord.edit( { refreshRecordFakeKey: '' } );
	userRecord.save();
}
