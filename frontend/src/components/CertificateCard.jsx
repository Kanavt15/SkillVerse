import React from 'react';
import { Award, Download, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';

const CertificateCard = ({ certificate, compact = false }) => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const issuedDate = new Date(certificate.issued_at).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
    });

    const handleDownload = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/certificates/${certificate.certificate_id}/download`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Download failed');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `SkillVerse-Certificate-${certificate.certificate_id}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download error:', error);
        }
    };

    const verifyUrl = `${window.location.origin}/verify/${certificate.certificate_id}`;

    if (compact) {
        return (
            <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 text-sm text-cyan-400 bg-cyan-500/10 rounded-lg px-3 py-1.5 hover:bg-cyan-500/20 transition-colors w-full justify-center"
            >
                <Award className="h-4 w-4" />
                <span>Download Certificate</span>
            </button>
        );
    }

    return (
        <div className="bg-gradient-to-br from-cyan-500/5 to-indigo-500/5 border border-cyan-500/20 rounded-xl p-5">
            <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center shrink-0">
                    <Award className="h-6 w-6 text-cyan-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-sm">Certificate of Completion</h3>
                    <p className="text-xs text-muted-foreground text-opacity-80 mt-0.5">{certificate.course_title}</p>
                    <p className="text-xs text-muted-foreground text-opacity-60 mt-0.5">Issued on {issuedDate}</p>
                    <div className="flex items-center gap-2 mt-3">
                        <Button size="sm" onClick={handleDownload} className="text-xs h-8">
                            <Download className="h-3 w-3 mr-1.5" />
                            Download PDF
                        </Button>
                        <a
                            href={verifyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground text-opacity-80 hover:text-cyan-400 transition-colors"
                        >
                            <ExternalLink className="h-3 w-3" />
                            Verify
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CertificateCard;
