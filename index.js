const objStore = require('objstore-cms');

const localStorageProvider = objStore.providers.localStorage;
localStore = objStore.use(localStorageProvider);
localStore.types.register(objStore.types.any);

//CMS Prototype
let objs;
let models;

const onModelListItemClick = function (e) {
    let modelId = this.dataset.id;
    objs.forEach(obj => {
        if (obj.model.id === modelId) {
            let el = document.createElement('ul');
            el.innerHTML = `<li data-id="${obj.id}">${obj.fields.color()}</li>`;
            document.querySelector('.objects ul').appendChild(el.children[0]);
        }
    })
};

/*
(async () => {
    objs = await localStore.read();
    models = await localStore.models.read();
    models.forEach(model => {
        let el = document.createElement('ul');
        el.innerHTML = `<li data-id="${model.id}">${model.name}</li>`;
        el.children[0].addEventListener('click', onModelListItemClick);
        document.querySelector('.models ul').appendChild(el.children[0]);
    });
})();*/

if ('Sortable' in window) {
    let fieldsTable = document.querySelector('.fields table tbody');
    Sortable.create(fieldsTable, {
        filter: 'tr:not(:first-child)',
        animation: 150,
        scroll: true,
        handle: '.drag_handle',
        onStart: () => fieldsTable.classList.add('sortable-dragging'),
        onEnd: () => fieldsTable.classList.remove('sortable-dragging')
    });
}

if ('autosize' in window) {
    autosize(document.querySelectorAll('textarea'));
}

const fieldTypeDialog = document.querySelector('.field_type_dialog');
const fieldTypeDialogCloseButton = document.querySelector('.field_type_dialog .close');
const addFieldButton = document.querySelector('.add_field');
addFieldButton.addEventListener('click', e => fieldTypeDialog.showModal());
fieldTypeDialog.addEventListener('close', e => console.log(fieldTypeDialog.returnValue));
fieldTypeDialogCloseButton.addEventListener('click', e => fieldTypeDialog.close());
