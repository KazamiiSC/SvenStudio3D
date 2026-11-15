# SvenStudio3D: Windows Explorer-style folder selection (IFileDialog / FOS_PICKFOLDERS).
# Invoked only by the localhost Node service. No filesystem writes are performed.
param([string]$InitialFolder = '')
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Runtime.InteropServices;

namespace SvenStudioNative {
    [ComImport, Guid("42f85136-db7e-439c-85f1-e4075d135fc8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IFileDialog {
        [PreserveSig] int Show(IntPtr parent);
        void SetFileTypes(uint count, IntPtr filters);
        void SetFileTypeIndex(uint index);
        void GetFileTypeIndex(out uint index);
        void Advise(IntPtr events, out uint cookie);
        void Unadvise(uint cookie);
        void SetOptions(uint options);
        void GetOptions(out uint options);
        void SetDefaultFolder(IShellItem folder);
        void SetFolder(IShellItem folder);
        void GetFolder(out IShellItem folder);
        void GetCurrentSelection(out IShellItem selection);
        void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string name);
        void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string name);
        void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string title);
        void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string label);
        void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string label);
        void GetResult(out IShellItem result);
        void AddPlace(IShellItem item, int position);
        void SetDefaultExtension([MarshalAs(UnmanagedType.LPWStr)] string extension);
        void Close(int hr);
        void SetClientGuid(ref Guid guid);
        void ClearClientData();
        void SetFilter(IntPtr filter);
    }

    [ComImport, Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IShellItem {
        void BindToHandler(IntPtr bind, ref Guid handler, ref Guid iid, out IntPtr result);
        void GetParent(out IShellItem parent);
        void GetDisplayName(uint displayName, out IntPtr name);
        void GetAttributes(uint mask, out uint attributes);
        void Compare(IShellItem other, uint hint, out int order);
    }

    public static class FolderPicker {
        private const uint FOS_PICKFOLDERS = 0x20;
        private const uint FOS_FORCEFILESYSTEM = 0x40;
        private const uint FOS_PATHMUSTEXIST = 0x800;
        private const uint FOS_NOCHANGEDIR = 0x8;
        private const uint SIGDN_FILESYSPATH = 0x80058000;
        private const int CANCELLED = unchecked((int)0x800704C7);
        private static readonly Guid ShellItemGuid = new Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe");
        private static readonly Guid FileOpenDialogGuid = new Guid("DC1C5A9C-E88A-4DDE-A5A1-60F82A20AEF7");

        [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
        private static extern void SHCreateItemFromParsingName(
            [MarshalAs(UnmanagedType.LPWStr)] string path, IntPtr bind,
            ref Guid iid, [MarshalAs(UnmanagedType.Interface)] out IShellItem item);

        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        // The owner is the active browser window so Windows keeps the picker in front.
        public static string Choose(string initialFolder) {
            object instance = Activator.CreateInstance(Type.GetTypeFromCLSID(FileOpenDialogGuid));
            IFileDialog dialog = (IFileDialog)instance;
            try {
                uint options;
                dialog.GetOptions(out options);
                dialog.SetOptions(options | FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM |
                                  FOS_PATHMUSTEXIST | FOS_NOCHANGEDIR);
                dialog.SetTitle("SvenStudio 3D - Select folder");
                if (!String.IsNullOrWhiteSpace(initialFolder) && Directory.Exists(initialFolder)) {
                    IShellItem initialItem = null;
                    try {
                        Guid shellGuid = ShellItemGuid;
                        SHCreateItemFromParsingName(initialFolder, IntPtr.Zero,
                                                     ref shellGuid, out initialItem);
                        dialog.SetFolder(initialItem);
                    } finally {
                        if (initialItem != null) Marshal.ReleaseComObject(initialItem);
                    }
                }
                int result = dialog.Show(GetForegroundWindow());
                if (result == CANCELLED) return null;
                if (result != 0) Marshal.ThrowExceptionForHR(result);
                IShellItem selected = null;
                try {
                    dialog.GetResult(out selected);
                    IntPtr selectedName;
                    selected.GetDisplayName(SIGDN_FILESYSPATH, out selectedName);
                    try { return Marshal.PtrToStringUni(selectedName); }
                    finally { Marshal.FreeCoTaskMem(selectedName); }
                } finally {
                    if (selected != null) Marshal.ReleaseComObject(selected);
                }
            } finally {
                Marshal.ReleaseComObject(instance);
            }
        }
    }
}
'@
$selected = [SvenStudioNative.FolderPicker]::Choose($InitialFolder)
if ($null -ne $selected) { [Console]::Out.Write($selected) }
