import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { enableBatching } from 'redux-batched-actions';

export interface LabelBayFeature {
    visible: boolean;
}

const slice = createSlice({
    name: 'labelBay',
    initialState: { visible: false } as LabelBayFeature,
    reducers: {
        setVisible: (state, action: PayloadAction<boolean>) => {
            state.visible = action.payload;
        },
    },
});

export const { reducer, actions } = slice;
export default enableBatching(reducer);
